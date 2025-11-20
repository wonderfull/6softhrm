import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_URL = 'http://localhost:4000/api'

async function audit() {
    console.log('🕵️‍♂️ Starting Security Audit...')

    const victimEmail = 'victim@6soft.co.uk'
    const attackerEmail = 'attacker@6soft.co.uk'

    // Cleanup
    await prisma.user.deleteMany({ where: { email: { in: [victimEmail, attackerEmail] } } })
    // Find employees to delete related data first
    const employees = await prisma.employee.findMany({ where: { email: { in: [victimEmail, attackerEmail] } } })
    const empIds = employees.map(e => e.id)

    if (empIds.length > 0) {
        await prisma.document.deleteMany({ where: { employeeId: { in: empIds } } })
        await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: empIds } } })
        await prisma.employee.deleteMany({ where: { id: { in: empIds } } })
    }

    try {
        // 1. Setup Victim (Employee + User + Doc + Leave)
        console.log('\n1️⃣  Setting up Victim...')
        const victimEmp = await prisma.employee.create({
            data: {
                firstName: 'Victim', lastName: 'User', email: victimEmail, employeeType: 'EMPLOYEE',
                documents: {
                    create: { name: 'Secret.pdf', path: '/uploads/secret.pdf' }
                },
                leaveRequests: {
                    create: { type: 'ANNUAL', startDate: new Date(), endDate: new Date(), reason: 'Secret Vacation' }
                }
            },
            include: { documents: true, leaveRequests: true }
        })
        const victimDocId = victimEmp.documents[0].id
        console.log(`   Victim ID: ${victimEmp.id}, Doc ID: ${victimDocId}`)

        // 2. Setup Attacker (Unlinked User)
        console.log('\n2️⃣  Setting up Attacker (Unlinked)...')
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: attackerEmail, password: 'password123', name: 'Attacker' })
        })

        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: attackerEmail, password: 'password123' })
        })
        const { token } = await loginRes.json()
        const headers = { Authorization: `Bearer ${token}` }

        // 3. Test Leave Request Leakage
        console.log('\n3️⃣  Testing Leave Request Leakage...')
        const leaveRes = await fetch(`${API_URL}/leave`, { headers })
        const leaves = await leaveRes.json()

        if (Array.isArray(leaves) && leaves.length > 0) {
            console.error('❌ VULNERABILITY CONFIRMED: Unlinked user can see leave requests!')
            console.log('   Leaked:', leaves.length, 'requests')
        } else {
            console.log('✅ SECURE: Unlinked user sees 0 leave requests')
        }

        // 4. Test Document Download (IDOR)
        console.log('\n4️⃣  Testing Document Download (IDOR)...')
        // Try to download victim's docs
        const dlRes = await fetch(`${API_URL}/documents/download-all/${victimEmp.id}`, { headers })
        if (dlRes.ok) {
            console.error('❌ VULNERABILITY CONFIRMED: Attacker can download victim documents!')
        } else {
            console.log(`✅ SECURE: Download blocked with status ${dlRes.status}`)
        }

        // 5. Test Document Delete (IDOR)
        console.log('\n5️⃣  Testing Document Delete (IDOR)...')
        const delRes = await fetch(`${API_URL}/documents/${victimDocId}`, {
            method: 'DELETE',
            headers
        })

        if (delRes.ok) {
            console.error('❌ VULNERABILITY CONFIRMED: Attacker deleted victim document!')
        } else {
            console.log(`✅ SECURE: Delete blocked with status ${delRes.status}`)
        }

        // Cleanup
        await prisma.user.deleteMany({ where: { email: { in: [victimEmail, attackerEmail] } } })

        // Re-fetch employees created during the audit for cleanup
        const currentEmployees = await prisma.employee.findMany({ where: { email: { in: [victimEmail, attackerEmail] } } })
        const currentEmpIds = currentEmployees.map(e => e.id)

        if (currentEmpIds.length > 0) {
            await prisma.document.deleteMany({ where: { employeeId: { in: currentEmpIds } } })
            await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: currentEmpIds } } })
            await prisma.employee.deleteMany({ where: { id: { in: currentEmpIds } } })
        }

    } catch (e) {
        console.error('Audit failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

audit()
