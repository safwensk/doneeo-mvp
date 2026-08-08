from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from doneeo_core import OrderStore, analyze_request, build_offers, transition_order


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
STORE = OrderStore(ROOT / "data" / "doneeo.db")


class DoneeoHandler(BaseHTTPRequestHandler):
    server_version = "DoneeoMVP/1.0"

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _static(self, relative: str) -> None:
        target = (STATIC / relative).resolve()
        if not str(target).startswith(str(STATIC.resolve())) or not target.is_file():
            self._json(404, {"error": "Not found"})
            return
        body = target.read_bytes()
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/provider"}:
            self._static("index.html")
        elif path == "/api/health":
            self._json(200, {"status": "ok", "service": "Doneeo Intelligence", "storage": "sqlite"})
        elif path == "/api/orders":
            self._json(200, {"orders": STORE.list()})
        elif path.startswith("/api/orders/"):
            order = STORE.get(path.rsplit("/", 1)[-1])
            self._json(200, order) if order else self._json(404, {"error": "Order not found"})
        else:
            self._static(path.lstrip("/"))

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self._body()
            if path == "/api/analyze":
                request = str(payload.get("request", "")).strip()
                if len(request) < 10:
                    self._json(400, {"error": "Describe the complete task in at least 10 characters."})
                    return
                self._json(200, analyze_request(request))
                return

            if path == "/api/offers":
                analysis = payload.get("analysis") or {}
                answers = payload.get("answers") or {}
                result = build_offers(analysis, answers)
                if result and result[0].get("gate") == "needs_information":
                    self._json(409, result[0])
                else:
                    self._json(200, {"offers": result})
                return

            if path == "/api/orders":
                analysis = payload.get("analysis") or {}
                answers = payload.get("answers") or {}
                offer = payload.get("offer") or {}
                if not offer.get("id"):
                    self._json(400, {"error": "A matched offer must be selected."})
                    return
                self._json(201, STORE.create(analysis, answers, offer))
                return

            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:2] == ["api", "orders"]:
                order = transition_order(STORE, parts[2], parts[3], payload)
                self._json(200, order)
                return

            self._json(404, {"error": "Not found"})
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
        except KeyError as exc:
            self._json(404, {"error": str(exc)})
        except ValueError as exc:
            self._json(409, {"error": str(exc)})
        except Exception as exc:
            self._json(500, {"error": f"Unexpected server error: {exc}"})

    def log_message(self, format: str, *args: object) -> None:
        print(f"[Doneeo] {self.address_string()} - {format % args}")


def run(host: str = "127.0.0.1", port: int = 8080) -> None:
    server = ThreadingHTTPServer((host, port), DoneeoHandler)
    print(f"Doneeo Intelligence running at http://{host}:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Doneeo Intelligence Python MVP")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    run(args.host, args.port)
