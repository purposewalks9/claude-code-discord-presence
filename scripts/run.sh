#!/bin/sh
# Finds a Node.js binary (hooks often run without nvm/volta on PATH) and runs the hook.
# Never fails: presence must not get in the way of Claude Code.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node 2>/dev/null)"
if [ -z "$NODE" ]; then
  for n in "$HOME"/.nvm/versions/node/*/bin/node "$HOME"/.volta/bin/node \
           "$HOME"/.local/share/fnm/aliases/default/bin/node "$HOME"/.asdf/shims/node \
           /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    [ -x "$n" ] && NODE="$n"
  done
fi
[ -z "$NODE" ] && { cat >/dev/null; exit 0; }
exec "$NODE" "$ROOT/src/hook.js"
