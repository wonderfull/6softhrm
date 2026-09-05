// The value is a parameter so a caller can validate a secret it holds rather
// than the live one — the deploy preflight checks the target environment
// without touching this process's own env.
export function getJwtSecret(
  configured: string | undefined = process.env.JWT_SECRET,
): string {
  const secret = configured?.trim();

  if (!secret || secret === 'change_me') {
    throw new Error('JWT_SECRET is not configured securely');
  }

  return secret;
}
