/**
 * Reset a user's password using the same bcrypt config the auth route uses.
 *
 * Usage (run on the VPS where DATABASE_URL is set):
 *   cd backend
 *   npx ts-node ../scripts/reset-user-password.ts \
 *     admin@example.com 'NEW_PASSWORD_HERE'
 *
 * The script does NOT echo the new password back to stdout. The caller is
 * expected to know what they passed in.
 *
 * Why this exists:
 *   COS-7 flagged that admin@example.com / password123 is in production. This
 *   one-shot lets us rotate to a strong secret without exposing prisma studio.
 */
import bcrypt from 'bcryptjs';
import prisma from '../backend/src/prismaClient';

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error(
      'Usage: ts-node scripts/reset-user-password.ts <email> <new-password>',
    );
    process.exit(2);
  }
  if (newPassword.length < 12) {
    console.error('Refusing: new password must be at least 12 chars.');
    process.exit(2);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hash },
  });
  console.log(`✅ Password updated for ${email} (id=${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
