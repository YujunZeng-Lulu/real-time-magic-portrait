#!/bin/bash
# Double-click to open the magic portrait. Close the frame (×) to quit.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/agent" || exit 1
pkill -f "agent.py dev" 2>/dev/null; sleep 1
source .venv/bin/activate
python agent.py dev > "$ROOT/agent.log" 2>&1 &
AGENT=$!
sleep 6
cd "$ROOT/widget"
if [ -f dist/index.html ]; then npx electron .; else npm start; fi
kill $AGENT 2>/dev/null; pkill -f "agent.py dev" 2>/dev/null
exit 0
