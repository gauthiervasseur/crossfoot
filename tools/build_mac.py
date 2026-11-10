#!/usr/bin/env python3
"""Build Crossfoot.app and Crossfoot-<version>.dmg (macOS only).

Called by tools/build.py; can also run on its own:
    /usr/bin/python3 tools/build_mac.py

Produces a universal (Apple silicon + Intel) app, ad-hoc signed. It is not
notarized: that needs an Apple Developer ID, so on first launch macOS asks
the user to confirm in System Settings > Privacy & Security > Open Anyway.
"""
import plistlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APP_SRC = ROOT / "app"
SWIFT = ROOT / "desktop" / "macos" / "CrossfootApp.swift"
DIST = ROOT / "dist"
# macOS 13+: the current Command Line Tools lack the Intel copies of Swift's
# back-compat libraries needed for older targets (and WKDownload needs 11.3+).
MIN_MACOS = "13.0"
BUNDLE_ID = "com.datawiseacademy.crossfoot"


def run(*cmd):
    subprocess.run(cmd, check=True)


def mac_icon_png(size):
    """Big Sur style icon, pre-rendered by tools/make_icon.py from tools/icon.svg."""
    img = Image.open(APP_SRC / "assets" / "icon-mac-1024.png").convert("RGBA")
    return img.resize((size, size), Image.LANCZOS)


def build_icns(out_icns):
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "Crossfoot.iconset"
        iconset.mkdir()
        for base in (16, 32, 128, 256, 512):
            mac_icon_png(base).save(iconset / f"icon_{base}x{base}.png")
            mac_icon_png(base * 2).save(iconset / f"icon_{base}x{base}@2x.png")
        run("iconutil", "-c", "icns", str(iconset), "-o", str(out_icns))


def build_binary(out):
    with tempfile.TemporaryDirectory() as tmp:
        slices = []
        for arch in ("arm64", "x86_64"):
            o = Path(tmp) / arch
            run("xcrun", "swiftc", "-O", "-target", f"{arch}-apple-macos{MIN_MACOS}",
                "-framework", "Cocoa", "-framework", "WebKit", str(SWIFT), "-o", str(o))
            slices.append(str(o))
        run("lipo", "-create", *slices, "-output", str(out))


def build_app(version, workdir):
    app = workdir / "Crossfoot.app"
    contents = app / "Contents"
    (contents / "MacOS").mkdir(parents=True)
    res = contents / "Resources"
    res.mkdir()
    build_binary(contents / "MacOS" / "Crossfoot")
    shutil.copytree(APP_SRC, res / "app", ignore=shutil.ignore_patterns(".DS_Store", "*.ttf", "icon-mac-1024.png"))
    build_icns(res / "Crossfoot.icns")
    with open(contents / "Info.plist", "wb") as f:
        plistlib.dump({
            "CFBundleName": "Crossfoot",
            "CFBundleDisplayName": "Crossfoot",
            "CFBundleIdentifier": BUNDLE_ID,
            "CFBundleExecutable": "Crossfoot",
            "CFBundleIconFile": "Crossfoot",
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": version,
            "CFBundleVersion": version,
            "CFBundleInfoDictionaryVersion": "6.0",
            "LSMinimumSystemVersion": MIN_MACOS,
            "LSApplicationCategoryType": "public.app-category.business",
            "NSHighResolutionCapable": True,
            "NSPrincipalClass": "NSApplication",
            "NSHumanReadableCopyright": "Crossfoot - BI for AFP. Plotly.js (MIT), Libre Franklin (OFL).",
        }, f)
    run("codesign", "--force", "--deep", "--sign", "-", str(app))
    return app


def build_dmg(version):
    DIST.mkdir(exist_ok=True)
    dmg = DIST / f"Crossfoot-{version}.dmg"
    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp) / "stage"
        stage.mkdir()
        app = build_app(version, stage)
        (stage / "Applications").symlink_to("/Applications")
        (stage / "First launch - read me.txt").write_text(
            "Install: drag Crossfoot onto the Applications folder.\n\n"
            "First launch: macOS may say it cannot check Crossfoot for malicious software,\n"
            "because the app is not notarized with Apple. To open it anyway:\n"
            "  1. Try to open Crossfoot once, then click Done.\n"
            "  2. Open System Settings > Privacy & Security.\n"
            "  3. Scroll down and click 'Open Anyway' next to Crossfoot, then confirm.\n"
            "You only need to do this once.\n\n"
            "Crossfoot runs entirely on your Mac. Your data never leaves your computer.\n"
        )
        if dmg.exists():
            dmg.unlink()
        run("hdiutil", "create", "-quiet", "-volname", f"Crossfoot {version}", "-srcfolder", str(stage),
            "-fs", "HFS+", "-format", "UDZO", "-imagekey", "zlib-level=9", "-ov", str(dmg))
        # Keep an unpacked copy for local testing (dist/ is a build folder).
        local = DIST / "Crossfoot.app"
        if local.exists():
            shutil.rmtree(local)
        shutil.copytree(app, local, symlinks=True)
    return dmg


def main(version=None):
    if sys.platform != "darwin":
        print("skipping macOS build: not on a Mac")
        return None
    if version is None:
        import re
        version = re.search(r"VERSION = '([^']+)'", (APP_SRC / "js" / "app.js").read_text()).group(1)
    dmg = build_dmg(version)
    print("built", dmg.relative_to(ROOT))
    return dmg


if __name__ == "__main__":
    main()
