# Claude Code Feature Tutorial — 6softHRM Examples

---

## 1. CLAUDE.md — Persistent Project Context

**What:** Included in every request. Like a permanent system prompt.

**3 locations:**
| File | Scope | Committed? |
|------|-------|-----------|
| `CLAUDE.md` | This project, whole team | Yes |
| `CLAUDE.local.md` | This project, you only | No (gitignored) |
| `~/.claude/CLAUDE.md` | All your projects | N/A |

**Quick add instruction with `#`:**
```
# Never modify migration files directly. Always use prisma migrate dev.
```
Claude merges this into your CLAUDE.md automatically.

**Reference a file inside CLAUDE.md:**
```markdown
The database schema is defined in @backend/prisma/schema.prisma.
Reference it whenever working with data models.
```
Now Claude reads the schema on every request — no need to mention it each time.

---

## 2. @ File Mentions — Pull in Specific Files

**What:** Inlines a file's content into your current request.

```
How does leave approval work? @backend/src/routes/leave.ts
```

Type `@` and Claude shows a filtered file picker. Select one or more files.

---

## 3. Custom Slash Commands — Reusable Prompts

**What:** Markdown files in `.claude/commands/` become `/commandname` shortcuts.

**This project has:**
| Command | Does |
|---------|------|
| `/dev` | Start both dev servers |
| `/test` | Run all tests (Jest + Vitest) |
| `/test-backend` | Backend Jest only |
| `/test-frontend` | Frontend Vitest only |
| `/db-migrate` | prisma migrate + generate |
| `/build` | tsc + vite production build |
| `/review` | Review git diff for issues |
| `/write-tests <file>` | Write tests for a file |

**With arguments — `$ARGUMENTS` placeholder:**
```
# .claude/commands/write-tests.md
Write comprehensive tests for: $ARGUMENTS
```
Usage: `/write-tests backend/src/routes/leave.ts`

**After creating a new command:** Restart Claude Code.

---

## 4. Planning Mode — Research Before Coding

**Activate:** `Shift+Tab` twice (or once if already auto-accepting edits)

**What Claude does:**
1. Reads many files across your project
2. Creates a detailed implementation plan
3. Shows you exactly what it will do
4. Waits for your approval

**Best for:** New features, multi-file changes, refactors.
**Not needed for:** Simple single-file fixes.

---

## 5. Thinking Modes — Deeper Reasoning

Add to any prompt:

| Phrase | Reasoning depth |
|--------|----------------|
| `think` | Basic |
| `think more` | Extended |
| `think a lot` | Comprehensive |
| `ultrathink` | Maximum |

**Example:**
```
ultrathink — why does the sponsorship expiry cron job sometimes fire twice?
```

**Best for:** Complex bugs, algorithm design, architecture decisions.
**Note:** Uses more tokens = higher cost. Use when stuck, not by default.

---

## 6. Conversation Control

| Action | How | When |
|--------|-----|------|
| Stop Claude mid-response | `Escape` | Going wrong direction |
| Rewind to earlier message | `Escape` twice | Remove distracting context |
| Keep knowledge, compress history | `/compact` | Long session, switching tasks |
| Full reset | `/clear` | Switching to unrelated task |
| Paste screenshot | `Ctrl+V` (not Cmd+V) | Show UI to modify |

**Escape + `#` pattern — fix recurring mistakes:**
1. Press `Escape` to stop
2. Type `# Do not use raw SQL. Always use the Prisma client.`
3. Claude merges this into CLAUDE.md — never makes that mistake again

---

## 7. Hooks — Auto-run Code on Tool Events

**What:** Scripts that fire before or after Claude uses a tool.

**Two types:**
| Type | Can block? | Use for |
|------|-----------|---------|
| `PreToolUse` | Yes (exit code 2) | Block access, enforce rules |
| `PostToolUse` | No | Format, lint, type-check, notify |

**Other hook types:** `Stop`, `Notification`, `SubagentStop`, `PreCompact`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`

**This project has:**

### Block .env reads (`hooks/block-env-read.js`)
```javascript
// PreToolUse on Read|Grep|Glob
if (filePath.includes('.env')) {
  console.error('BLOCKED: .env files contain secrets');
  process.exit(2);  // ← exit code 2 = block + send error to Claude
}
```

### Auto-format on edit (`hooks/format-on-edit.js`)
```javascript
// PostToolUse on Write|Edit
execSync(`npx prettier --write "${filePath}"`);
```

### TypeScript check on edit (`hooks/typecheck-on-edit.js`)
```javascript
// PostToolUse on Write|Edit — backend files only
execSync('npx tsc --noEmit', { cwd: backendDir });
// Errors printed to stderr → fed back to Claude automatically
```

**Config in `.claude/settings.local.json`:**
```json
"hooks": {
  "PreToolUse": [{ "matcher": "Read|Grep|Glob", "hooks": [{ "type": "command", "command": "/abs/path/hooks/block-env-read.js" }] }],
  "PostToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "/abs/path/hooks/format-on-edit.js" }] }]
}
```

**Security rule:** Always use **absolute paths** in hook commands (not `$PWD` or relative). That's why this project has `settings.example.json` + `scripts/init-claude.js` — run the init script on any new machine to generate `settings.local.json` with your machine's absolute paths.

**Debug unknown hook data:**
```json
{ "matcher": "*", "hooks": [{ "type": "command", "command": "jq . > hook-debug.json" }] }
```
Check `hook-debug.json` to see the exact stdin structure for any hook.

**Stdin structure varies by hook type:**
- `PreToolUse`/`PostToolUse` → includes `tool_name` + `tool_input`
- `Stop` → includes `stop_hook_active` only
- `PostToolUse` TodoWrite → includes `tool_response.oldTodos` + `newTodos`

---

## 8. MCP Servers — New Tools for Claude

**What:** Plugins that give Claude abilities beyond the built-in tools.

**Playwright (installed for this project):**
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

**What you can now do:**
```
Open localhost:5173, check that the Leave Request page renders correctly,
and take a screenshot showing the current layout.
```

**Pre-approve in settings (skip permission prompts):**
```json
"allow": ["mcp__playwright__*"]
```

**Other useful MCP servers:** database access, Slack, GitHub, file system ops.

---

## 9. GitHub Actions Integration

**Setup (run once inside Claude Code):**
```
/install-github-app
```

**Creates two workflows:**
1. **Mention** — `@claude` in any issue/PR → Claude acts on it with full codebase access
2. **PR Review** — every new PR gets auto-reviewed by Claude

**Customize `.github/workflows/claude.yml`** after merging:
```yaml
custom_instructions: |
  Stack: Express+TypeScript backend (port 4000), React+Vite frontend (port 5173).
  DB: MySQL via Prisma. Auth: JWT. Run npm install before testing.
```

---

## 10. Permissions & Settings

**File:** `.claude/settings.local.json` (gitignored — regenerate with `node scripts/init-claude.js`)

**Auto-allow commands so Claude doesn't ask every time:**
```json
"permissions": {
  "allow": ["Bash(npm:*)", "Bash(npx:*)", "Bash(git:*)", "mcp__playwright__*"]
}
```

---

## Quick Reference Card

```
/init              → first-time setup (creates CLAUDE.md)
#                  → memory mode (edit CLAUDE.md inline)
@filename          → include file in current request
/commandname       → run custom command
Shift+Tab x2       → planning mode
Escape             → stop Claude
Escape x2          → rewind conversation
/compact           → compress history, keep knowledge
/clear             → full reset
Ctrl+V             → paste screenshot
"ultrathink ..."   → maximum reasoning
```
