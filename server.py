import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib import request, error

ORIGIN = "http://127.0.0.1:8000"

def write_json(handler, status, obj):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", ORIGIN)
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(json.dumps(obj).encode("utf-8"))

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/roadmap":
            write_json(self, 404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if api_key:
            try:
                prompt = self._build_prompt(payload)
                resp = self._openai_chat(api_key, prompt)
                recs = self._extract_recommendations(resp)
                write_json(self, 200, {"recommendations": recs})
                return
            except Exception:
                pass

        # Heuristic fallback (no key or API error)
        write_json(self, 200, {"recommendations": self._heuristics(payload)})

    def _build_prompt(self, payload):
        m = payload.get("metrics", {})
        region = payload.get("region", "GLOBAL")
        lines = [
            "You are a pragmatic sustainability advisor for small businesses.",
            "Return 5 short, actionable recommendations with fast payback.",
            "No added commentary, just a simple list.",
            f"Region: {region}",
            f"Monthly_tCO2e: {m.get('monthlyT')}",
            f"Annual_tCO2e: {m.get('annualT')}",
            f"Intensity_t_per_emp_yr: {m.get('intensityTPerEmp')}",
            f"Fossil_share: {m.get('fossilShare')}",
            f"AC_share: {m.get('acSharePct')}",
            f"Score: {m.get('score')} Risk: {m.get('risk')}",
        ]
        return "\n".join(lines)

    def _openai_chat(self, api_key, prompt):
        url = "https://api.openai.com/v1/chat/completions"
        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a sustainability advisor."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 300,
        }
        req = request.Request(url, method="POST")
        req.add_header("Authorization", f"Bearer {api_key}")
        req.add_header("Content-Type", "application/json")
        with request.urlopen(req, data=json.dumps(data).encode("utf-8"), timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _extract_recommendations(self, resp):
        choices = resp.get("choices", [])
        if not choices:
            return self._heuristics({})
        content = choices[0]["message"]["content"]
        lines = [l.strip(" -0123456789.").strip() for l in content.splitlines() if l.strip()]
        lines = [l for l in lines if l]
        return lines[:6]

    def _heuristics(self, payload):
        m = payload.get("metrics", {})
        fossil = float(m.get("fossilShare") or 0)
        ac = float(m.get("acSharePct") or 0)
        score = float(m.get("score") or 0)
        recs = []
        if fossil > 0.15:
            recs.append("Reduce diesel generator use; optimize maintenance and load management")
        if ac > 0.4:
            recs.append("Introduce AC schedules, higher setpoints, and zonal cooling")
        if score < 70:
            recs.append("Upgrade to LEDs and enforce workstation sleep policies")
        if score < 50:
            recs.append("Adopt renewable-backed tariff or purchase RECs where available")
        recs.append("Track monthly bills and set a 12‑month reduction target")
        return recs[:6]

def main():
    host, port = "127.0.0.1", 8001
    httpd = HTTPServer((host, port), Handler)
    print(f"AI API listening on http://{host}:{port}/")
    httpd.serve_forever()

if __name__ == "__main__":
    main()

