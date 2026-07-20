#!/usr/bin/env bash
# tldraw offline Canvas API helper — removes the per-session boilerplate of
# reading the token, targeting the focused doc, and capturing screenshots.
#
#   canvas.sh readme            # print the live self-documenting API reference
#   canvas.sh docs              # list open documents
#   canvas.sh exec <file.js>    # run a JS file against the focused doc's Editor
#   canvas.sh shot              # screenshot focused doc (prints a JPEG path to Read)
#
# The token in server.json rotates every app launch, so this reads it fresh each call.
set -euo pipefail

# server.json (port + per-launch token) location differs by OS — the tldraw API readme lists these.
case "$(uname -s)" in
  Darwin) SJ="$HOME/Library/Application Support/tldraw/server.json" ;;
  Linux)  SJ="${XDG_CONFIG_HOME:-$HOME/.config}/tldraw/server.json" ;;
  *)      SJ="${APPDATA:-$HOME/AppData/Roaming}/tldraw/server.json" ;;   # Windows (git-bash / WSL)
esac

launch_app() {                    # best-effort auto-launch; only macOS is reliable
  case "$(uname -s)" in
    Darwin) open -a "tldraw offline" 2>/dev/null || true ;;
    *)      : ;;                  # elsewhere the user launches it manually
  esac
}
ensure_up() {
  if [ ! -f "$SJ" ]; then
    launch_app
    for _ in $(seq 1 30); do [ -f "$SJ" ] && break; sleep 1; done
  fi
  [ -f "$SJ" ] || { echo "tldraw offline is not running — install/open it from offline.tldraw.com (expected $SJ)" >&2; exit 1; }
}
val() { python3 -c "import json;print(json.load(open('$SJ'))['$1'])"; }
result() { python3 -c "import json,sys;d=json.load(sys.stdin);print(('ERROR: '+str(d.get('error'))) if not d.get('success') else (d.get('result') if d.get('result') is not None else 'ok'))"; }

ensure_up
PORT=$(val port); TOKEN=$(val token); BASE="http://127.0.0.1:$PORT"
AUTH=(-H "authorization: Bearer $TOKEN" -H 'content-type: application/json')
focused() { curl -s -m 12 -X POST "$BASE/api/search" "${AUTH[@]}" \
  -d '{"code":"const d=await api.getFocusedDoc();return d?d.id:null"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['result'])"; }

case "${1:-}" in
  readme) curl -s "$BASE/" ;;
  docs)   curl -s -X POST "$BASE/api/search" "${AUTH[@]}" \
            -d '{"code":"return (await api.getDocs()).map(d=>({id:d.id,name:d.name}))"}' | result ;;
  exec)   [ -n "${2:-}" ] || { echo "usage: canvas.sh exec <file.js>" >&2; exit 1; }
          DOC=$(focused)
          python3 -c "import json;print(json.dumps({'code':open('$2').read()}))" > /tmp/_tldraw_payload.json
          curl -s -m 90 -X POST "$BASE/api/doc/$DOC/exec" "${AUTH[@]}" -d @/tmp/_tldraw_payload.json | result ;;
  shot)   DOC=$(focused)
          curl -s -m 30 -X POST "$BASE/api/search" "${AUTH[@]}" \
            -d "{\"code\":\"const d=await api.getFocusedDoc();return (await api.getScreenshot(d.id,{size:'large'})).filePath\"}" | result ;;
  *) echo "usage: canvas.sh {readme|docs|exec <file.js>|shot}" >&2; exit 1 ;;
esac
