import os
import sys
import json
import socket
import threading
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Determine base paths
def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def get_dist_dir():
    if getattr(sys, 'frozen', False):
        meipass = getattr(sys, '_MEIPASS', None)
        if meipass and os.path.exists(os.path.join(meipass, 'dist')):
            return os.path.join(meipass, 'dist')
        app_dir = get_app_dir()
        cand_internal = os.path.join(app_dir, '_internal', 'dist')
        if os.path.exists(cand_internal):
            return cand_internal
        cand_root = os.path.join(app_dir, 'dist')
        if os.path.exists(cand_root):
            return cand_root
    
    # Development fallback
    app_dir = get_app_dir()
    cand1 = os.path.join(app_dir, 'front-end', 'dist')
    if os.path.exists(cand1):
        return cand1
    cand2 = os.path.join(app_dir, 'dist')
    if os.path.exists(cand2):
        return cand2
    return cand1

def load_config():
    app_dir = get_app_dir()
    config_path = os.path.join(app_dir, 'config.json')
    default_config = {
        "api_url": "http://127.0.0.1:8000",
        "ws_url": "ws://127.0.0.1:8000/ws/chat/",
        "window_title": "UserBot Chat",
        "window_width": 1280,
        "window_height": 840
    }
    if not os.path.exists(config_path):
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2)
        except Exception:
            pass
        return default_config
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            return {**default_config, **cfg}
    except Exception:
        return default_config

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class AppRequestHandler(SimpleHTTPRequestHandler):
    dist_dir = ''
    config = {}

    def translate_path(self, path):
        # Serve from dist_dir securely; prevent path traversal
        path_clean = path.split('?', 1)[0].split('#', 1)[0]
        rel_path = os.path.normpath(path_clean.lstrip('/\\'))
        full_path = os.path.abspath(os.path.join(self.dist_dir, rel_path))
        base_dir = os.path.abspath(self.dist_dir)
        if not full_path.startswith(base_dir):
            return os.path.join(self.dist_dir, 'index.html')
        return full_path

    def do_GET(self):
        clean_path = self.path.split('?', 1)[0].split('#', 1)[0]
        
        # Injected index.html
        if clean_path in ('/', '/index.html'):
            index_path = os.path.join(self.dist_dir, 'index.html')
            if os.path.exists(index_path):
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Injected global config for React frontend
                    cfg_js = (
                        f'<script>'
                        f'window.__USERBOT_CONFIG__ = '
                        f'{{"apiBaseUrl": "{self.config.get("api_url", "http://127.0.0.1:8000")}", '
                        f'"wsBaseUrl": "{self.config.get("ws_url", "ws://127.0.0.1:8000/ws/chat/")}"}};'
                        f'</script>'
                    )
                    if '<head>' in content:
                        content = content.replace('<head>', f'<head>\n  {cfg_js}', 1)
                    else:
                        content = cfg_js + content

                    body = content.encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(body)))
                    self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    self.end_headers()
                    self.wfile.write(body)
                    return
                except Exception as e:
                    self.send_error(500, f"Error rendering index: {e}")
                    return

        # Serve static assets
        local_file = self.translate_path(self.path)
        if os.path.exists(local_file) and os.path.isfile(local_file):
            return super().do_GET()

        # SPA Fallback for routes
        index_path = os.path.join(self.dist_dir, 'index.html')
        if os.path.exists(index_path):
            self.path = '/index.html'
            return self.do_GET()

        self.send_error(404, "File not found")

    def log_message(self, format, *args):
        # Suppress noisy HTTP logs in console
        pass

def start_server(dist_dir, config, port):
    AppRequestHandler.dist_dir = dist_dir
    AppRequestHandler.config = config
    server = ThreadingHTTPServer(('127.0.0.1', port), AppRequestHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server

def main():
    config = load_config()
    dist_dir = get_dist_dir()
    
    if not os.path.exists(dist_dir):
        print(f"Error: Dist directory not found at {dist_dir}")
        sys.exit(1)

    port = find_free_port()
    server = start_server(dist_dir, config, port)
    app_url = f"http://127.0.0.1:{port}"

    title = config.get("window_title", "UserBot Chat")
    width = config.get("window_width", 1280)
    height = config.get("window_height", 840)

    try:
        import webview
        window = webview.create_window(
            title=title,
            url=app_url,
            width=width,
            height=height,
            min_size=(480, 600),
            background_color='#0a0a0c',
            text_select=True
        )
        webview.start(debug=False)
    except Exception as e:
        print(f"Failed to launch native webview: {e}")
        # Fallback to default browser if webview fails
        import webbrowser
        webbrowser.open(app_url)
        input("Press Enter to exit...")

if __name__ == '__main__':
    main()
