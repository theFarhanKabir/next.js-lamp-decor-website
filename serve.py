import http.server
import socketserver
import os

os.chdir(os.path.join(os.path.dirname(__file__), 'dist'))

PORT = 5233
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Server running at http://127.0.0.1:{PORT}/")
    httpd.serve_forever()
