#!/bin/bash
# MaisonVide — Rendu headless de toutes les pages + capture d'erreurs console
# Usage : bash tools/render-check.sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="${1:-/tmp/mv-render}"
BASE="${2:-http://127.0.0.1:8080}"
mkdir -p "$OUT"
cd "$PROJECT_ROOT" 2>/dev/null || cd "$(dirname "$0")/.."
PAGES=$(ls *.html admin/*.html)
FAIL=0
for p in $PAGES; do
  name=$(echo "$p" | tr '/' '_')
  log="$OUT/$name.log"
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --virtual-time-budget=7000 --window-size=1400,1000 \
    --enable-logging=stderr --v=0 \
    --screenshot="$OUT/$name.png" "$BASE/$p" > "$log" 2>&1
  size=$(stat -f%z "$OUT/$name.png" 2>/dev/null || echo 0)
  # grep -c renvoie 0 ET sort en erreur quand il ne trouve rien :
  # sans `|| true`, la sortie devenait "0\n0" et le test plantait.
  errs=$(grep -ciE "ERROR:CONSOLE|Uncaught|SyntaxError|ReferenceError|TypeError" "$log" 2>/dev/null || true)
  errs=${errs:-0}
  if [ "$size" -lt 12000 ]; then
    echo "  ⚠ $p  (image $size o — page quasi vide)"; FAIL=1
  elif [ "$errs" -gt 0 ]; then
    echo "  ✗ $p  ($errs erreur(s) console)"; FAIL=1
    grep -iE "ERROR:CONSOLE|Uncaught|SyntaxError|ReferenceError|TypeError" "$log" | head -4 | sed 's/^/      /'
  else
    echo "  ✓ $p"
  fi
done
echo "---"
[ $FAIL -eq 0 ] && echo "  Toutes les pages se rendent sans erreur console." || echo "  Anomalies détectées (voir ci-dessus)."
exit $FAIL
