/**
 * Debug hook — logs hook stdin data to hook-debug.json.
 * Use temporarily to inspect what data Claude sends to a hook.
 *
 * Usage in settings: replace any hook command with:
 *   "command": "node /absolute/path/hooks/debug-log.js"
 *
 * Then check hooks/hook-debug.json to see the exact JSON structure.
 * Remove this hook from settings when done debugging.
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks).toString();
  const outPath = path.resolve(__dirname, 'hook-debug.json');
  fs.writeFileSync(outPath, JSON.stringify(JSON.parse(data), null, 2));
}

main().catch(() => process.exit(0));
