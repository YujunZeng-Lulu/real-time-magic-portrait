#!/bin/bash
# Double-click to force-close everything.
pkill -f "agent.py dev" 2>/dev/null
pkill -f "magic-portrait/widget" 2>/dev/null
pkill -f "avatar-widget/widget" 2>/dev/null
echo "Closed. 👋"
sleep 1
