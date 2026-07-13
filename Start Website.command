#!/bin/zsh
# Double-click this file to run Sydney's portfolio site locally.
# It starts the dev server and opens the site in your browser.
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"

if lsof -ti :5173 >/dev/null 2>&1; then
  echo "Site is already running — opening it in your browser."
  open http://localhost:5173
  exit 0
fi

( sleep 2.5; open http://localhost:5173 ) &
echo "Starting the site... your browser will open in a moment."
echo "Keep this window open while you browse. Press Ctrl+C (or close the window) to stop."
npm run dev
