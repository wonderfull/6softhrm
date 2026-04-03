/**
 * PreToolUse hook — blocks Claude from reading .env files.
 * Exit code 2 = block the tool call and send error message to Claude.
 */
async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const toolArgs = JSON.parse(Buffer.concat(chunks).toString());
  const filePath =
    toolArgs.tool_input?.file_path ||
    toolArgs.tool_input?.path ||
    toolArgs.tool_input?.pattern ||
    '';

  if (filePath.includes('.env')) {
    console.error('BLOCKED: .env files contain secrets and must not be read by Claude.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('Hook error:', err.message);
  process.exit(0); // Don't block on hook errors
});
