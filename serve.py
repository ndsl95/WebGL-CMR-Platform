"""开发服务器：禁止缓存（改完刷新即生效）+ HTTP Range（视频拖动 / Safari 播放需要）。用法：python3 serve.py [端口]，默认 8080。"""
import http.server, os, re, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate'); self.send_header('Accept-Ranges', 'bytes'); super().end_headers()
    def send_head(self):
        m = re.match(r'bytes=(\d*)-(\d*)$', self.headers.get('Range') or ''); path = self.translate_path(self.path)
        if not m or os.path.isdir(path) or not os.path.exists(path): return super().send_head()
        size = os.path.getsize(path); a = int(m.group(1) or 0); b = int(m.group(2)) if m.group(2) else size - 1; b = min(b, size - 1)
        f = open(path, 'rb'); f.seek(a); self._left = b - a + 1
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path)); self.send_header('Content-Range', f'bytes {a}-{b}/{size}'); self.send_header('Content-Length', str(self._left)); self.end_headers(); return f
    def copyfile(self, src, dst):
        left = getattr(self, '_left', None)
        if left is None: return super().copyfile(src, dst)
        while left > 0:
            buf = src.read(min(65536, left))
            if not buf: break
            dst.write(buf); left -= len(buf)
        self._left = None

if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1]) if len(sys.argv) > 1 else 8080), Handler).serve_forever()
