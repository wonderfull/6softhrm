import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
    const email = 'browser.test@6soft.co.uk'

    // Cleanup
    await prisma.user.deleteMany({ where: { email } })
    await prisma.employee.deleteMany({ where: { email } })

    // Create Employee
    await prisma.employee.create({
        data: {
            firstName: 'Browser',
            lastName: 'Test',
            email: email,
            employeeType: 'EMPLOYEE',
            jobTitle: 'Test Engineer'
        }
    })

    console.log('✅ Seeded employee:', email)
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
