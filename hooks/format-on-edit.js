/**
 * PostToolUse hook — auto-formats TypeScript/JavaScript files after Claude edits them.
 * Uses Prettier with project config.
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

  const formattableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'];
  const ext = path.extname(filePath);

  if (filePath && formattableExtensions.includes(ext)) {
    try {
      const projectRoot = path.resolve(__dirname, '..');
      execSync(`npx prettier --write "${filePath}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch (_e) {
      // Non-blocking — Prettier failure should not interrupt Claude's workflow
    }
  }
}

main().catch(() => process.exit(0));
