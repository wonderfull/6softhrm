/**
 * PostToolUse hook — runs TypeScript compiler after backend file edits.
 * Feeds type errors back to Claude so it can fix them immediately.
 */
const { execSync } = require('child_process');
const path = require('path');

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const toolArgs = JSON.parse(Buffer.concat(chunks).toString());
  const filePath = toolArgs.tool_input?.file_path || '';

  // Only run for backend TypeScript files
  if (filePath.includes('/backend/') && filePath.endsWith('.ts') && !filePath.includes('/dist/')) {
    try {
      const backendDir = path.resolve(__dirname, '../backend');
      execSync('npx tsc --noEmit', { cwd: backendDir, stdio: 'pipe' });
    } catch (e) {
      const errors = e.stdout?.toString() || e.stderr?.toString() || '';
      if (errors.trim()) {
        console.error('TypeScript errors detected after edit — please fix:\n' + errors);
      }
    }
  }
}

main().catch(() => process.exit(0));
