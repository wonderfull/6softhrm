/**
 * Tool to link User accounts to Employee records by matching email addresses
 * Run this script to automatically link users to their employee records
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function linkUsersToEmployees() {
  try {
    console.log('Starting to link users to employees...\n')
    
    // Get all users
    const users = await prisma.user.findMany({
      where: { employeeId: null }
    })
    
    console.log(`Found ${users.length} users without employee links\n`)
    
    let linkedCount = 0
    let notFoundCount = 0
    
    for (const user of users) {
      // Try to find employee with matching email
      const employee = await prisma.employee.findUnique({
        where: { email: user.email }
      })
      
      if (employee) {
        // Link user to employee
        await prisma.user.update({
          where: { id: user.id },
          data: { employeeId: employee.id }
        })
        console.log(`✓ Linked user ${user.email} to employee ${employee.firstName} ${employee.lastName}`)
        linkedCount++
      } else {
        console.log(`✗ No employee found for user ${user.email}`)
        notFoundCount++
      }
    }
    
    console.log(`\n=== Summary ===`)
    console.log(`Successfully linked: ${linkedCount}`)
    console.log(`Not found: ${notFoundCount}`)
    console.log(`Total processed: ${users.length}`)
    
  } catch (error) {
    console.error('Error linking users to employees:', error)
  } finally {
    await prisma.$disconnect()
  }
}

linkUsersToEmployees()
