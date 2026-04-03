Review the current git changes for code quality:
1. Run `git diff` and `git diff --staged` to see all changes
2. Check for: security vulnerabilities, TypeScript type errors, broken patterns, missing error handling
3. Run `npm --prefix backend run build` to catch TypeScript compilation errors
4. Check that GDPR audit logging is present on any sensitive operations
5. Verify no .env or secrets are accidentally included

Provide a concise list of findings grouped by: Critical Issues, Warnings, Suggestions.
