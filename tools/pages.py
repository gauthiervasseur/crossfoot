#!/usr/bin/env python3
"""Assemble the GitHub Pages site for Crossfoot into website/ (stdlib only).

    python3 tools/pages.py

Uses the packaging code of tools/build.py (zip, live copy in play/, theme and demo downloads), but
skips what needs a Mac (icons, Swift). The DMG and the Windows installer are not part of the site:
the page links to the latest GitHub Release for them.
"""
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build  # noqa: E402

repo = os.environ.get("GITHUB_REPOSITORY", "gauthiervasseur/crossfoot")
RELEASE = f"https://github.com/{repo}/releases/latest/download/"

zpath = build.package()
build.build_site(zpath, None)

out = ROOT / "_site"
if out.exists():
    shutil.rmtree(out)
shutil.copytree(ROOT / "website", out, ignore=shutil.ignore_patterns(".DS_Store"))
page = out / "index.html"
html = page.read_text(encoding="utf-8")
for name in ("Crossfoot-latest.dmg", "Crossfoot-latest-Setup.exe"):
    html = html.replace(f"download/{name}", RELEASE + name)
page.write_text(html, encoding="utf-8")
(out / ".nojekyll").touch()
print("site ->", out, "| installers ->", RELEASE)
