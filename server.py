import http.server
import socketserver

PORT = 3000
Handler = http.server.SimpleHTTPRequestHandler

print(f"Server starting at http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Open this URL in your browser to view the site")
    httpd.serve_forever()