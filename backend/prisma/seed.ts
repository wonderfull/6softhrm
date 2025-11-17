import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      name: 'Admin User',
      role: 'ADMIN',
    },
  })

  const emp = await prisma.employee.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      niNumber: 'QQ123456C',
      jobTitle: 'Software Engineer',
      startDate: new Date('2024-01-02'),
    },
  })

  await prisma.sponsorship.upsert({
    where: { id: 1 },
    update: {},
    create: {
      employeeId: emp.id,
      visaType: 'Skilled Worker',
      sponsorLicenseNumber: 'LIC-UK-0001',
      startDate: new Date('2024-01-02'),
      endDate: new Date('2026-01-01'),
      complianceNotes: 'Initial sponsorship record',
    },
  })

  console.log({ admin })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
