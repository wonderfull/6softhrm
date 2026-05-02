export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()

  if (!secret || secret === 'change_me') {
    throw new Error('JWT_SECRET is not configured securely')
  }

  return secret
}
