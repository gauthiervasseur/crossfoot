# /// script
# requires-python = ">=3.10"
# dependencies = ["pywebview>=5"]
# ///
"""
Crossfoot for Windows: a native window around the offline web app.

The web app (../../app) is served from 127.0.0.1 and shown in a WebView2 window (the same Edge
engine as the browser version). A local server rather than file:// keeps one stable address, so
saved layouts and themes survive between launches. Nothing leaves the PC and no account is needed.

  uv run desktop/windows/crossfoot_win.py             window (what Crossfoot.exe does)
  uv run desktop/windows/crossfoot_win.py --browser   same app in your default browser
  uv run desktop/windows/crossfoot_win.py --serve     server only (prints the address)

Packaged by tools/build_windows.ps1 (PyInstaller). Also runs on a Mac, which is how it is tested.
"""
from __future__ import annotations

import functools
import mimetypes
import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FROZEN = bool(getattr(sys, "frozen", False))
# Packaged: app/ sits inside the bundle. From the repo: Crossfoot/app.
APP_DIR = Path(getattr(sys, "_MEIPASS", "")) / "app" if FROZEN else Path(__file__).resolve().parents[2] / "app"
PORT = 8766  # fixed so the browser origin (and its localStorage) stays the same between launches

# Windows reads MIME types from the registry, where .js is sometimes text/plain: pin the ones we need.
for ext, kind in {".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
                  ".csv": "text/csv", ".woff2": "font/woff2", ".ttf": "font/ttf", ".html": "text/html"}.items():
    mimetypes.add_type(kind, ext)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # a windowed app has no console
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def data_dir() -> Path:
    appdata = os.environ.get("APPDATA") if sys.platform == "win32" else None
    return Path(appdata) / "Crossfoot" if appdata else Path.home() / ".crossfoot"


def start_server() -> tuple[ThreadingHTTPServer, str]:
    handler = functools.partial(Handler, directory=str(APP_DIR))
    for port in (PORT, 0):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError:
            continue
    else:
        raise RuntimeError("No free port")
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/index.html"


def main() -> None:
    # A windowed Windows app has no console: sys.stdout is None and print() would raise.
    for name in ("stdout", "stderr"):
        if getattr(sys, name) is None:
            setattr(sys, name, open(os.devnull, "w", encoding="utf-8"))
    if {"-h", "--help"} & set(sys.argv):
        print(__doc__)
        return
    if not (APP_DIR / "index.html").exists():
        sys.exit(f"Crossfoot: web app not found at {APP_DIR}")
    server, url = start_server()
    print(f"Crossfoot is running at {url}", flush=True)

    if "--serve" in sys.argv:
        print("Press Ctrl+C to stop.", flush=True)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            server.shutdown()
        return

    if "--browser" not in sys.argv:
        try:
            import webview

            # Exports (PNG, SVG, CSV, .crossfoot.json) are downloads: let WebView2 show its Save dialog.
            webview.settings["ALLOW_DOWNLOADS"] = True
            webview.create_window("Crossfoot", url, width=1440, height=900, min_size=(900, 600),
                                  background_color="#FFFFFF")
            store = data_dir() / "webview"
            store.mkdir(parents=True, exist_ok=True)
            # private_mode=False keeps saved layouts, filters and the theme between launches.
            webview.start(private_mode=False, storage_path=str(store))
            server.shutdown()
            return
        except Exception as e:  # no WebView2 / pywebview: fall back to the browser
            print(f"Native window unavailable ({e}); opening the browser instead.", flush=True)

    webbrowser.open(url)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
