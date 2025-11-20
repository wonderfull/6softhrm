import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_URL = 'http://localhost:4000/api'

async function verify() {
    console.log('🚀 Starting Verification...')

    // Cleanup previous test data
    const testEmail = 'test.linkage@6soft.co.uk'
    await prisma.user.deleteMany({ where: { email: testEmail } })
    await prisma.employee.deleteMany({ where: { email: testEmail } })

    try {
        // 1. Create Employee first
        console.log('\n1️⃣  Creating Employee...')
        const emp = await prisma.employee.create({
            data: {
                firstName: 'Test',
                lastName: 'Linkage',
                email: testEmail,
                employeeType: 'EMPLOYEE'
            }
        })
        console.log('✅ Employee created:', emp.id)

        // 2. Create User (should auto-link)
        console.log('\n2️⃣  Creating User...')

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123',
                    name: 'Test Linkage'
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(JSON.stringify(err))
            }
            console.log('✅ User registered via API')
        } catch (e: any) {
            console.error('❌ Failed to register user:', e.message)
            process.exit(1)
        }

        // 3. Verify Linkage
        console.log('\n3️⃣  Verifying Linkage...')
        const user = await prisma.user.findUnique({ where: { email: testEmail } })
        if (user?.employeeId === emp.id) {
            console.log('✅ SUCCESS: User is linked to Employee ID', user?.employeeId)
        } else {
            console.error('❌ FAILURE: User is NOT linked. EmployeeId:', user?.employeeId)
        }

        // 4. Test Document Security (Unlinked User)
        console.log('\n4️⃣  Testing Document Security (Unlinked User)...')
        // Create an unlinked user
        const unlinkedEmail = 'unlinked@6soft.co.uk'
        await prisma.user.deleteMany({ where: { email: unlinkedEmail } })

        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: unlinkedEmail,
                password: 'password123',
                name: 'Unlinked User'
            })
        })

        // Login to get token
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: unlinkedEmail,
                password: 'password123'
            })
        })
        const loginData = await loginRes.json()
        const token = loginData.token

        // Try to fetch documents
        try {
            const docsRes = await fetch(`${API_URL}/documents`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const docsData = await docsRes.json()

            if (Array.isArray(docsData) && docsData.length === 0) {
                console.log('✅ SUCCESS: Unlinked user received empty document list')
            } else {
                console.error('❌ FAILURE: Unlinked user received data:', docsData)
            }
        } catch (e: any) {
            console.error('❌ Failed to fetch documents:', e.message)
        }

        // Cleanup
        await prisma.user.deleteMany({ where: { email: { in: [testEmail, unlinkedEmail] } } })
        await prisma.employee.deleteMany({ where: { email: testEmail } })

    } catch (e) {
        console.error('Verification failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

verify()
