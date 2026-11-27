/* Crossfoot - calculated measures: OLAP formulas over aggregates.
 *
 * A calculation is a named formula such as
 *     SUM([Gross Profit ($)]) / SUM([Revenue ($)])
 *     SUM([Revenue ($)]) / TOTAL(SUM([Revenue ($)]))
 * Every field appears inside an aggregate, so the formula is evaluated per
 * group (cell, bar, subtotal, grand total) from that group's aggregates: a
 * ratio is always SUM/SUM over the group, never an average of row ratios.
 *
 * Grammar
 *   expr    := term (('+' | '-') term)*
 *   term    := power (('*' | '/') power)*
 *   power   := unary ('^' unary)?
 *   unary   := '-' unary | primary
 *   primary := number | '(' expr ')' | FUNC '(' args ')' | [Calculation name]
 *   AGG     := SUM | AVG | MEDIAN | MIN | MAX | COUNT | COUNTD   (one [Field], or COUNT(*))
 *   FUNC    := AGG | TOTAL(expr) | ROUND(expr[, digits]) | ABS(expr) | SQRT(expr)
 * TOTAL(x) evaluates x over every row in view (after filters): the grand total.
 * Null-safe: a missing aggregate, a division by zero or an overflow gives an
 * empty cell rather than an error.
 *
 * In the engine a calculated measure is a field of type 'calc'. Its spec hands
 * the row index to its own accumulator (makeAcc), which feeds one plain Acc per
 * aggregate in the formula; prepare(idx) computes the TOTAL() aggregates once.
 */
(function () {
  'use strict';
  const T = (window.Crossfoot = window.Crossfoot || {});

  const AGG_NAMES = { SUM: 'sum', AVG: 'avg', AVERAGE: 'avg', MEAN: 'avg', MEDIAN: 'median', MIN: 'min', MAX: 'max',
    COUNT: 'count', CNT: 'count', COUNTD: 'countd', CNTD: 'countd' };
  const AGG_TOKEN = { sum: 'SUM', avg: 'AVG', median: 'MEDIAN', min: 'MIN', max: 'MAX', count: 'COUNT', countd: 'COUNTD' };
  const FUNCS = { TOTAL: [1, 1], ROUND: [1, 2], ABS: [1, 1], SQRT: [1, 1] };
  const FORMATS = [['number', 'Number'], ['percent', 'Percent'], ['usd', 'Currency $'], ['eur', 'Currency €']];

  class CalcError extends Error {
    constructor(msg, pos) { super(msg); this.pos = pos; }
  }

  /* ---------------------------------------------------------------- lexer */

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '[') {
        let j = i + 1, name = '';
        for (;;) {
          if (j >= src.length) throw new CalcError('Missing ] to close the field name', i);
          if (src[j] === ']') { if (src[j + 1] === ']') { name += ']'; j += 2; continue; } break; }
          name += src[j++];
        }
        if (!name.trim()) throw new CalcError('Empty field name []', i);
        out.push({ t: 'field', v: name.trim(), pos: i, end: j + 1 });
        i = j + 1;
        continue;
      }
      const num = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i));
      if (num) { out.push({ t: 'num', v: parseFloat(num[0]), pos: i, end: i + num[0].length }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (id) { out.push({ t: 'id', v: id[0].toUpperCase(), pos: i, end: i + id[0].length }); i += id[0].length; continue; }
      const op = { '+': '+', '-': '-', '−': '-', '–': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '^': '^', '(': '(', ')': ')', ',': ',', ';': ',' }[c];
      if (op) { out.push({ t: op, pos: i, end: i + 1 }); i++; continue; }
      throw new CalcError(`Unexpected character "${c}"`, i);
    }
    out.push({ t: 'eof', pos: src.length, end: src.length });
    return out;
  }

  /* --------------------------------------------------------------- parser */

  function parse(src) {
    const toks = tokenize(src);
    let k = 0;
    const peek = () => toks[k];
    const next = () => toks[k++];
    const expect = (t, msg) => { const x = next(); if (x.t !== t) throw new CalcError(msg, x.pos); return x; };
    const describe = (x) => (x.t === 'eof' ? 'the end of the formula' : x.t === 'field' ? '[' + x.v + ']' : x.t === 'num' ? String(x.v) : x.t === 'id' ? x.v : '"' + x.t + '"');

    function expr() {
      let l = term();
      while (peek().t === '+' || peek().t === '-') { const o = next(); l = { k: 'bin', op: o.t, l, r: term(), pos: o.pos }; }
      return l;
    }
    function term() {
      let l = power();
      while (peek().t === '*' || peek().t === '/') { const o = next(); l = { k: 'bin', op: o.t, l, r: power(), pos: o.pos }; }
      return l;
    }
    function power() {
      const l = unary();
      if (peek().t === '^') { const o = next(); return { k: 'bin', op: '^', l, r: unary(), pos: o.pos }; }
      return l;
    }
    function unary() {
      if (peek().t === '-') { const o = next(); return { k: 'neg', x: unary(), pos: o.pos }; }
      if (peek().t === '+') { next(); return unary(); }
      return primary();
    }
    function primary() {
      const x = next();
      if (x.t === 'num') return { k: 'num', v: x.v, pos: x.pos };
      if (x.t === '(') { const e = expr(); expect(')', 'Missing ) to close the bracket'); return e; }
      if (x.t === 'field') return { k: 'ref', name: x.v, pos: x.pos };
      if (x.t === 'id') {
        const agg = AGG_NAMES[x.v];
        if (!agg && !FUNCS[x.v]) throw new CalcError(`Unknown function ${x.v}. Use SUM, AVG, MEDIAN, MIN, MAX, COUNT, COUNTD, TOTAL, ROUND, ABS or SQRT`, x.pos);
        expect('(', `${x.v} needs brackets, e.g. ${x.v}(${agg ? '[Field]' : '...'})`);
        if (agg) {
          const a = next();
          let field;
          if (a.t === 'field') field = a.v;
          else if (a.t === '*' && agg === 'count') field = T.RECORDS;
          else throw new CalcError(`${x.v} takes one field in square brackets, e.g. ${x.v}([Revenue])`, a.pos);
          expect(')', `Missing ) after ${x.v}([${field}]`);
          return { k: 'agg', agg, field, pos: x.pos, fieldPos: a.pos };
        }
        const args = [expr()];
        while (peek().t === ',') { next(); args.push(expr()); }
        expect(')', `Missing ) to close ${x.v}(`);
        const [lo, hi] = FUNCS[x.v];
        if (args.length < lo || args.length > hi) throw new CalcError(`${x.v} takes ${lo === hi ? lo : lo + ' or ' + hi} argument${hi > 1 ? 's' : ''}`, x.pos);
        return { k: 'fn', fn: x.v, args, pos: x.pos };
      }
      throw new CalcError(x.t === 'eof' ? 'The formula ends too early' : `Unexpected ${describe(x)}`, x.pos);
    }

    if (!src.trim()) throw new CalcError('Write a formula, e.g. SUM([Revenue]) / SUM([Units])', 0);
    const ast = expr();
    if (peek().t !== 'eof') throw new CalcError(`Unexpected ${describe(peek())}: an operator (+ − × ÷) is missing?`, peek().pos);
    return ast;
  }

  /* -------------------------------------------------------------- compile */

  /**
   * Resolve references against the dataset and collect aggregate slots.
   * Returns { ok, error, pos, slots: [{agg, field, total}], ast, usesTotal, refs }.
   */
  function compile(ds, def, stack) {
    stack = stack || [def.name];
    try {
      const ast = parse(def.formula || '');
      const slots = [], index = new Map(), refs = new Set();
      let usesTotal = false;
      const slot = (agg, field, total) => {
        const key = (total ? 'T' : 'R') + agg + '|' + field;
        if (!index.has(key)) { index.set(key, slots.length); slots.push({ agg, field, total }); }
        return index.get(key);
      };
      const walk = (n, total) => {
        switch (n.k) {
          case 'num': return n;
          case 'neg': return { k: 'neg', x: walk(n.x, total) };
          case 'bin': return { k: 'bin', op: n.op, l: walk(n.l, total), r: walk(n.r, total) };
          case 'fn':
            if (n.fn === 'TOTAL') { usesTotal = true; return walk(n.args[0], true); }
            return { k: 'fn', fn: n.fn, args: n.args.map((a) => walk(a, total)) };
          case 'agg': {
            const f = ds.byName[n.field];
            if (!f) throw new CalcError(`No field named [${n.field}]`, n.fieldPos);
            if (f.type === 'calc') throw new CalcError(`[${n.field}] is a calculation: use it without ${AGG_TOKEN[n.agg]}( )`, n.pos);
            if (!T.allowedAggs(f).includes(n.agg)) {
              const ok = T.allowedAggs(f).map((a) => AGG_TOKEN[a]).join(', ');
              throw new CalcError(`${AGG_TOKEN[n.agg]} does not apply to [${n.field}] (${f.type === 'string' ? 'text' : f.type}); use ${ok}`, n.pos);
            }
            return { k: 'slot', i: slot(n.agg, n.field, total) };
          }
          case 'ref': {
            const f = ds.byName[n.name];
            if (!f) throw new CalcError(`No field or calculation named [${n.name}]`, n.pos);
            if (f.type !== 'calc') {
              const agg = T.defaultAgg(f);
              throw new CalcError(`Wrap [${n.name}] in an aggregate, e.g. ${AGG_TOKEN[agg]}([${n.name}])`, n.pos);
            }
            if (stack.includes(f.name)) throw new CalcError(`[${n.name}] refers back to itself`, n.pos);
            const sub = compile(ds, f.calc, stack.concat(f.name));
            if (!sub.ok) throw new CalcError(`[${n.name}] has an error: ${sub.error}`, n.pos);
            refs.add(f.name); sub.refs.forEach((r) => refs.add(r));
            if (sub.usesTotal) usesTotal = true;
            // Inline the referenced calculation, re-numbering its slots into ours.
            // Inside TOTAL(), every slot of the referenced formula is a total slot.
            const remap = sub.slots.map((s) => slot(s.agg, s.field, s.total || total));
            const inline = (m) => {
              if (m.k === 'slot') return { k: 'slot', i: remap[m.i] };
              if (m.k === 'neg') return { k: 'neg', x: inline(m.x) };
              if (m.k === 'bin') return { k: 'bin', op: m.op, l: inline(m.l), r: inline(m.r) };
              if (m.k === 'fn') return { k: 'fn', fn: m.fn, args: m.args.map(inline) };
              if (m.k === 'pct') return { k: 'pct', x: inline(m.x) };
              return m;
            };
            const body = inline(sub.ast);
            // A percent-formatted calculation stores x100; use its plain ratio inside other formulas.
            return f.calc.format === 'percent' ? { k: 'bin', op: '/', l: body, r: { k: 'num', v: 100 } } : body;
          }
        }
        throw new CalcError('Unsupported expression', 0);
      };
      let ast2 = walk(ast, false);
      if (!slots.length) throw new CalcError('Use at least one aggregate, e.g. SUM([Revenue])', 0);
      if (def.format === 'percent') ast2 = { k: 'pct', x: ast2 };
      return { ok: true, slots, ast: ast2, usesTotal, refs: Array.from(refs) };
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      return { ok: false, error: e.message, pos: e.pos || 0, slots: [], ast: null, refs: [] };
    }
  }

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  function evaluate(n, vals, tots) {
    switch (n.k) {
      case 'num': return n.v;
      case 'slot': return vals[n.i] === undefined ? tots[n.i] : vals[n.i];
      case 'neg': { const x = evaluate(n.x, vals, tots); return x === null ? null : -x; }
      case 'pct': { const x = evaluate(n.x, vals, tots); return x === null ? null : x * 100; }
      case 'bin': {
        const a = evaluate(n.l, vals, tots); if (a === null) return null;
        const b = evaluate(n.r, vals, tots); if (b === null) return null;
        switch (n.op) {
          case '+': return num(a + b);
          case '-': return num(a - b);
          case '*': return num(a * b);
          case '/': return b === 0 ? null : num(a / b);
          case '^': return num(Math.pow(a, b));
        }
        return null;
      }
      case 'fn': {
        const a = n.args.map((x) => evaluate(x, vals, tots));
        if (a[0] === null) return null;
        switch (n.fn) {
          case 'ABS': return Math.abs(a[0]);
          case 'SQRT': return a[0] < 0 ? null : Math.sqrt(a[0]);
          case 'ROUND': { const d = a.length > 1 && a[1] !== null ? Math.round(a[1]) : 0; const p = Math.pow(10, d); return Math.round(a[0] * p) / p; }
        }
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ formatting */

  function formatter(def) {
    const d = def.decimals;
    const nf = d === null || d === undefined || d === ''
      ? (def.format === 'percent' ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null)
      : new Intl.NumberFormat(undefined, { minimumFractionDigits: +d, maximumFractionDigits: +d });
    const n = (v) => (nf ? nf.format(v) : T.fmtNum(v));
    switch (def.format) {
      case 'percent': return (v) => (v === null ? '' : n(v) + '%');
      case 'usd': return (v) => (v === null ? '' : (v < 0 ? '−$' + n(-v) : '$' + n(v)));
      case 'eur': return (v) => (v === null ? '' : n(v) + ' €');
      default: return (v) => (v === null ? '' : n(v));
    }
  }

  /* ------------------------------------------------------------ engine spec */

  /** The measure spec for a calculated field (see measureSpec in data.js). */
  function spec(ds, f) {
    const def = f.calc;
    const c = f._compiled || (f._compiled = compile(ds, def));
    const getters = c.slots.map((s) => T.measureSpec(ds, { field: s.field, agg: s.agg }).get);
    const rowSlots = [], totSlots = [];
    c.slots.forEach((s, j) => (s.total ? totSlots : rowSlots).push(j));
    let tots = [];
    function CalcAcc() { this.accs = c.slots.map((s) => (s.total ? null : new T.Acc(s.agg))); }
    CalcAcc.prototype.add = function (i) { for (const j of rowSlots) this.accs[j].add(getters[j](i)); };
    CalcAcc.prototype.value = function () {
      if (!c.ok) return null;
      const vals = this.accs.map((a) => (a ? a.value() : undefined));
      return evaluate(c.ast, vals, tots);
    };
    return {
      field: f, agg: 'calc', label: def.name, calc: def, error: c.ok ? null : c.error,
      get: (i) => i,
      fmt: formatter(def),
      makeAcc: () => new CalcAcc(),
      prepare(idx) {
        if (!totSlots.length) return;
        const accs = c.slots.map((s) => (s.total ? new T.Acc(s.agg) : null));
        for (let r = 0; r < idx.length; r++) { const i = idx[r]; for (const j of totSlots) accs[j].add(getters[j](i)); }
        tots = accs.map((a) => (a ? a.value() : undefined));
      },
    };
  }

  /** Field object registered in ds.fields / ds.byName for a calculation. */
  const field = (def) => ({ name: def.name, type: 'calc', role: 'measure', values: null, calc: def });

  /** Recognise the guided-builder shapes: A op B, and A / TOTAL(A) (share of total). */
  function guided(formula) {
    try {
      const a = parse(formula);
      const isAgg = (n) => n && n.k === 'agg';
      if (a.k === 'bin' && isAgg(a.l) && isAgg(a.r)) return { a: { agg: a.l.agg, field: a.l.field }, op: a.op, b: { agg: a.r.agg, field: a.r.field } };
      if (a.k === 'bin' && a.op === '/' && isAgg(a.l) && a.r.k === 'fn' && a.r.fn === 'TOTAL' && isAgg(a.r.args[0])
        && a.r.args[0].agg === a.l.agg && a.r.args[0].field === a.l.field) return { a: { agg: a.l.agg, field: a.l.field }, op: 'share', b: null };
    } catch (e) { /* not a guided shape */ }
    return null;
  }

  const quote = (name) => '[' + String(name).replace(/\]/g, ']]') + ']';
  const aggText = (agg, field) => (field === T.RECORDS && agg === 'count' ? 'COUNT(*)' : AGG_TOKEN[agg] + '(' + quote(field) + ')');

  /** Rename a field reference inside a formula, leaving everything else as typed. */
  function renameRef(formula, from, to) {
    try {
      const toks = tokenize(formula);
      let out = '', last = 0;
      for (const t of toks) if (t.t === 'field' && t.v === from) { out += formula.slice(last, t.pos) + quote(to); last = t.end; }
      return out + formula.slice(last);
    } catch (e) { return formula; }
  }

  T.Calc = { AGG_TOKEN, FORMATS, parse, compile, evaluate, spec, field, guided, quote, aggText, renameRef, formatter };
})();
