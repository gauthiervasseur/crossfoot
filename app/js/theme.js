/* Crossfoot - visualization themes loaded from a plain CSS file.
 *
 * A theme is ordinary CSS. Crossfoot reads custom properties named --crossfoot-*
 * (from any rule), plus plain font-family / color / background on :root,
 * html, body or .crossfoot as fallbacks. @import and @font-face rules are
 * injected into the page so web fonts load.
 */
(function () {
  'use strict';
  const T = (window.Crossfoot = window.Crossfoot || {});

  // Default: the AFP brand theme, from the AFP-25 template (styles/afp.css): Dark Blue
  // #002B49 ink, Medium Blue #0076A8 accent, Light Orange, Green and Dark Orange,
  // Franklin Gothic when installed with Libre Franklin embedded as the free stand-in.
  // Categorical orders are validated (lightness band, chroma, CVD, contrast) against
  // their own surface. AFP Night is its dark twin, with the same hue per slot.
  const AFP = `/* Crossfoot theme: AFP (default, light) */
:root {
  --crossfoot-theme-name: "AFP";
  --crossfoot-font-family: "Franklin Gothic Book", "Libre Franklin", Arial, sans-serif;
  --crossfoot-title-font-family: "Franklin Gothic Medium", "Libre Franklin", Arial, sans-serif;
  --crossfoot-font-size: 13px;
  --crossfoot-title-font-size: 16px;
  --crossfoot-text-color: #002b49;
  --crossfoot-muted-color: #5a6b78;
  --crossfoot-background: #fffefd;
  --crossfoot-plot-background: #fffefd;
  --crossfoot-grid-color: #e4e1dd;
  --crossfoot-palette: #0076a8, #f08a24, #0b7e5e, #5b4a9e, #e94628, #1597b5, #b08900, #a8326e;
  --crossfoot-sequential: #e3f1f6, #002b49;
  --crossfoot-table-header-background: #002b49;
  --crossfoot-table-header-color: #ffffff;
  --crossfoot-table-border-color: #d3d0cc;
  --crossfoot-table-total-background: #ebe9e7;
}
`;

  const AFP_NIGHT = `/* Crossfoot theme: AFP NIGHT (dark) */
:root {
  --crossfoot-theme-name: "AFP Night";
  --crossfoot-font-family: "Franklin Gothic Book", "Libre Franklin", Arial, sans-serif;
  --crossfoot-title-font-family: "Franklin Gothic Medium", "Libre Franklin", Arial, sans-serif;
  --crossfoot-font-size: 13px;
  --crossfoot-title-font-size: 16px;
  --crossfoot-text-color: #eef3f6;
  --crossfoot-muted-color: #9db2c2;
  --crossfoot-background: #061a2b;
  --crossfoot-plot-background: #061a2b;
  --crossfoot-grid-color: #19344a;
  --crossfoot-palette: #2f8fc4, #d9741a, #1f9e78, #8a78d4, #ef5a3a, #1f9cb0, #b48c0e, #d0609a;
  --crossfoot-sequential: #0e2c44, #77cbd5;
  --crossfoot-table-header-background: #0076a8;
  --crossfoot-table-header-color: #ffffff;
  --crossfoot-table-border-color: #1d3a52;
  --crossfoot-table-total-background: #0c2438;
}
`;

  // Kept from the original arcade edition. Categorical order is the validated
  // colour-blind-safe dark-surface palette from the dataviz method.
  const ARCADE = `/* Crossfoot theme: ARCADE (retro) */
:root {
  --crossfoot-theme-name: "Arcade";
  --crossfoot-font-family: "VT323", "Courier New", monospace;
  --crossfoot-title-font-family: "Press Start 2P", "VT323", monospace;
  --crossfoot-font-size: 19px;
  --crossfoot-title-font-size: 12px;
  --crossfoot-text-color: #f0efec;
  --crossfoot-muted-color: #b9b2dd;
  --crossfoot-background: #120b2e;
  --crossfoot-plot-background: #120b2e;
  --crossfoot-grid-color: #2f2660;
  --crossfoot-palette: #3987e5, #d95926, #199e70, #c98500, #d55181, #008300, #9085e9, #e66767;
  --crossfoot-sequential: #1d3a6e, #b7d3f6;
  --crossfoot-table-header-background: #1f1550;
  --crossfoot-table-header-color: #ffd400;
  --crossfoot-table-border-color: #33296b;
  --crossfoot-table-total-background: #1a1145;
}
`;

  const CORPORATE = `/* Crossfoot theme: CORPORATE (light) */
:root {
  --crossfoot-theme-name: "Corporate";
  --crossfoot-font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --crossfoot-title-font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --crossfoot-font-size: 13px;
  --crossfoot-text-color: #0b0b0b;
  --crossfoot-muted-color: #52514e;
  --crossfoot-background: #fcfcfb;
  --crossfoot-plot-background: #fcfcfb;
  --crossfoot-grid-color: #e6e5e0;
  --crossfoot-palette: #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #6250d6, #e34948;
  --crossfoot-sequential: #cde2fb, #104281;
  --crossfoot-table-header-background: #f0efec;
  --crossfoot-table-header-color: #0b0b0b;
  --crossfoot-table-border-color: #e6e5e0;
  --crossfoot-table-total-background: #f5f4f1;
}
`;

  const PRESETS = { AFP, 'AFP Night': AFP_NIGHT, Arcade: ARCADE, Corporate: CORPORATE };

  /* ----------------------------------------------------------- color utils */

  const probe = document.createElement('canvas').getContext('2d');
  function toRGB(c) {
    if (!c || !CSS.supports('color', c)) return null;
    probe.fillStyle = '#000';
    probe.fillStyle = c;
    const s = probe.fillStyle; // "#rrggbb" or "rgba(r, g, b, a)"
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const m = s.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : null;
  }
  const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) {
    const A = toRGB(a), B = toRGB(b);
    if (!A || !B) return a;
    return hex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function luminance(c) {
    const rgb = toRGB(c);
    if (!rgb) return 0;
    const l = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  /** Readable ink for text drawn on `bg` (used for heat-shaded table cells). */
  function inkOn(bg, dark, light) { return luminance(bg) > 0.38 ? dark : light; }

  /** Split "a, rgb(1,2,3), b" on top-level commas only. */
  function splitList(v) {
    const out = []; let depth = 0, cur = '';
    for (const ch of v) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  const unquote = (s) => (s || '').trim().replace(/^["']|["']$/g, '');

  /* --------------------------------------------------------------- parsing */

  const BASE_SELECTORS = /^(:root|html|body|\.crossfoot|\.crossfoot-theme|\*)$/;

  function parse(cssText) {
    const warnings = [];
    const imports = [];
    // Strip comments first, then pull out @import rules. URLs may contain ';'
    // (Google Fonts: "wght@400;600"), so match the quoted/url() part as a unit.
    const body = cssText
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import\s+(?:url\(\s*(['"]?)([^'")]*)\1\s*\)|(['"])(.*?)\3)[^;]*;/gi, (m, q1, u1, q2, u2) => {
        imports.push(u1 || u2); return '';
      });
    const vars = {};
    const fontFaces = [];
    let sheet;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(body);
    } catch (e) {
      throw new Error('This CSS could not be read: ' + e.message);
    }
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSFontFaceRule) { fontFaces.push(rule.cssText); continue; }
      if (!(rule instanceof CSSStyleRule)) continue;
      const base = rule.selectorText.split(',').some((s) => BASE_SELECTORS.test(s.trim()));
      for (let k = 0; k < rule.style.length; k++) {
        const p = rule.style[k];
        if (p.startsWith('--crossfoot-') || base) vars[p] = rule.style.getPropertyValue(p).trim();
      }
    }
    const d = resolve({}); // defaults (from AFP) for anything not given
    const get = (...names) => { for (const n of names) if (vars[n]) return vars[n]; return null; };
    const color = (v, fallback, label) => {
      if (!v) return fallback;
      if (toRGB(v)) return v;
      warnings.push('Ignored ' + label.toLowerCase() + ': "' + v + '" is not a color');
      return fallback;
    };

    const t = {};
    t.name = unquote(get('--crossfoot-theme-name')) || 'Custom';
    t.fontFamily = get('--crossfoot-font-family', 'font-family') || d.fontFamily;
    t.titleFontFamily = get('--crossfoot-title-font-family') || t.fontFamily;
    t.fontSize = parseFloat(get('--crossfoot-font-size', 'font-size')) || (vars['--crossfoot-font-family'] || vars['font-family'] ? 13 : d.fontSize);
    t.titleFontSize = parseFloat(get('--crossfoot-title-font-size')) || Math.round(t.fontSize * 1.15);
    t.background = color(get('--crossfoot-background', 'background-color', 'background'), d.background, 'BACKGROUND');
    t.text = color(get('--crossfoot-text-color', 'color'), luminance(t.background) > 0.4 ? '#0b0b0b' : '#f0efec', 'Text color');
    t.muted = color(get('--crossfoot-muted-color'), mix(t.text, t.background, 0.35), 'Muted color');
    t.plotBackground = color(get('--crossfoot-plot-background'), t.background, 'Plot background');
    t.grid = color(get('--crossfoot-grid-color'), mix(t.background, t.text, 0.14), 'Grid color');

    let palette = [];
    const list = get('--crossfoot-palette');
    if (list) palette = splitList(list);
    for (let k = 1; k <= 12; k++) { const c = vars['--crossfoot-color-' + k]; if (c) palette[k - 1] = c; }
    palette = palette.filter((c) => {
      if (toRGB(c)) return true;
      warnings.push('Ignored palette color "' + c + '"'); return false;
    });
    if (!palette.length) palette = d.palette;
    if (palette.length > 8) warnings.push('Palette has ' + palette.length + ' colors: only the first 8 are used, the rest fold into "other"');
    t.palette = palette.slice(0, 8);
    t.other = mix(t.background, t.text, 0.45);

    const seq = get('--crossfoot-sequential');
    const seqList = seq ? splitList(seq).filter((c) => toRGB(c)) : [];
    t.sequential = seqList.length >= 2 ? seqList : [mix(t.background, t.palette[0], 0.15), t.palette[0]];

    t.tableHeaderBackground = color(get('--crossfoot-table-header-background'), mix(t.background, t.text, 0.07), 'Table header background');
    t.tableHeaderText = color(get('--crossfoot-table-header-color'), t.text, 'Table header color');
    t.tableBorder = color(get('--crossfoot-table-border-color'), t.grid, 'Table border color');
    t.tableTotalBackground = color(get('--crossfoot-table-total-background'), mix(t.background, t.text, 0.04), 'Table total background');

    const fontCss = imports.map((u) => '@import url("' + u + '");').join('\n') + '\n' + fontFaces.join('\n');
    return { theme: t, fontCss, warnings };
  }

  // Defaults for anything a custom theme leaves out: the AFP theme's values.
  let DEFAULTS = null;
  function resolve() {
    if (DEFAULTS) return DEFAULTS;
    DEFAULTS = {
      fontFamily: '"Franklin Gothic Book", "Libre Franklin", Arial, sans-serif', fontSize: 13, background: '#fffefd',
      palette: ['#0076a8', '#f08a24', '#0b7e5e', '#5b4a9e', '#e94628', '#1597b5', '#b08900', '#a8326e'],
    };
    return DEFAULTS;
  }

  /** Inject the theme's web fonts and expose its values as CSS variables on `el`. */
  function apply(parsed, el) {
    let style = document.getElementById('crossfoot-theme-fonts');
    if (!style) { style = document.createElement('style'); style.id = 'crossfoot-theme-fonts'; document.head.appendChild(style); }
    style.textContent = parsed.fontCss;
    const t = parsed.theme;
    const s = el.style;
    s.setProperty('--viz-font', t.fontFamily);
    s.setProperty('--viz-title-font', t.titleFontFamily);
    s.setProperty('--viz-font-size', t.fontSize + 'px');
    s.setProperty('--viz-title-size', t.titleFontSize + 'px');
    s.setProperty('--viz-bg', t.background);
    s.setProperty('--viz-text', t.text);
    s.setProperty('--viz-muted', t.muted);
    s.setProperty('--viz-grid', t.grid);
    s.setProperty('--viz-accent', t.palette[0]);
    s.setProperty('--viz-th-bg', t.tableHeaderBackground);
    s.setProperty('--viz-th-text', t.tableHeaderText);
    s.setProperty('--viz-border', t.tableBorder);
    s.setProperty('--viz-total-bg', t.tableTotalBackground);
    // Resolve once fonts are actually usable, so charts measure text correctly.
    const fams = [t.fontFamily, t.titleFontFamily].map((f) => splitList(f)[0]).filter(Boolean);
    return Promise.all(fams.map((f) => document.fonts.load(t.fontSize + 'px ' + f).catch(() => null))).then(() => document.fonts.ready);
  }

  /** Serialize a resolved theme back to a CSS file (used for "download template"). */
  function toCSS(t) {
    return `/* Crossfoot visualization theme.
 * Load it with THEME CSS in Crossfoot. Every variable is optional.
 * Web fonts: add @import url("https://fonts.googleapis.com/...") or @font-face rules at the top.
 */
:root {
  --crossfoot-theme-name: "${t.name}";
  --crossfoot-font-family: ${t.fontFamily};
  --crossfoot-title-font-family: ${t.titleFontFamily};
  --crossfoot-font-size: ${t.fontSize}px;
  --crossfoot-title-font-size: ${t.titleFontSize}px;
  --crossfoot-text-color: ${t.text};
  --crossfoot-muted-color: ${t.muted};
  --crossfoot-background: ${t.background};
  --crossfoot-plot-background: ${t.plotBackground};
  --crossfoot-grid-color: ${t.grid};
  /* Categorical colors, in order. Up to 8; more series fold into "Other". */
  --crossfoot-palette: ${t.palette.join(', ')};
  /* Low and high ends of the single-hue ramp used by heatmaps and heat cells. */
  --crossfoot-sequential: ${t.sequential.join(', ')};
  --crossfoot-table-header-background: ${t.tableHeaderBackground};
  --crossfoot-table-header-color: ${t.tableHeaderText};
  --crossfoot-table-border-color: ${t.tableBorder};
  --crossfoot-table-total-background: ${t.tableTotalBackground};
}
`;
  }

  T.Theme = { AFP, AFP_NIGHT, ARCADE, CORPORATE, PRESETS, parse, apply, toCSS, mix, toRGB, luminance, inkOn };
})();
