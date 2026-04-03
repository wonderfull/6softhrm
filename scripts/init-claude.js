/**
 * init-claude.js — Initialize Claude Code settings with absolute paths.
 *
 * The course recommends using absolute paths in hook commands (not $PWD) to
 * prevent path interception attacks. But absolute paths differ per machine,
 * so we store settings.example.json with $PWD placeholders and replace them
 * at setup time.
 *
 * Usage: node scripts/init-claude.js
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, '.claude', 'settings.example.json');
const outputPath = path.join(projectRoot, '.claude', 'settings.local.json');

if (!fs.existsSync(templatePath)) {
  console.error('ERROR: .claude/settings.example.json not found.');
  process.exit(1);
}

let content = fs.readFileSync(templatePath, 'utf8');
content = content.replace(/\$PWD/g, projectRoot);

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Claude Code settings written to: ${outputPath}`);
console.log(`Hooks will use absolute path: ${projectRoot}/hooks/`);
console.log('Restart Claude Code for changes to take effect.');
