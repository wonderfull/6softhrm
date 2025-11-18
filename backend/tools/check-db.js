const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const empCount = await p.employee.count();
    const userCount = await p.user.count();
    console.log('Employee count:', empCount);
    console.log('User count:', userCount);
  } catch (err) {
    console.error('Error querying DB:', err.message || err);
  } finally {
    await p.$disconnect();
  }
})();
