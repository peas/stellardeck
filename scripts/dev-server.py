#!/usr/bin/env python3
"""Dev server with no-cache headers for Tauri development.

WKWebView aggressively caches files from devUrl.
This server sends Cache-Control: no-store to prevent stale HTML/JS.

Usage: python3 scripts/dev-server.py [port]
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 3031
print(f"Dev server on http://127.0.0.1:{port} (no-cache)")
HTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
