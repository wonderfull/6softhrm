import { config } from 'dotenv'
import { resolve } from 'path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

function getArg(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function resolveValue(argName: string, envName: string) {
  return getArg(argName) || process.env[envName]
}

async function upsertUser(role: 'ADMIN' | 'MANAGER', options: { email?: string; password?: string; name?: string }) {
  if (!options.email || !options.password) return null

  const passwordHash = await bcrypt.hash(options.password, 10)
  const user = await prisma.user.upsert({
    where: { email: options.email },
    update: {
      name: options.name || undefined,
      password: passwordHash,
      role,
    },
    create: {
      email: options.email,
      password: passwordHash,
      name: options.name || `${role} User`,
      role,
    }
  })

  return user
}

async function main() {
  const admin = await upsertUser('ADMIN', {
    email: resolveValue('admin-email', 'BOOTSTRAP_ADMIN_EMAIL'),
    password: resolveValue('admin-password', 'BOOTSTRAP_ADMIN_PASSWORD'),
    name: resolveValue('admin-name', 'BOOTSTRAP_ADMIN_NAME'),
  })

  const manager = await upsertUser('MANAGER', {
    email: resolveValue('manager-email', 'BOOTSTRAP_MANAGER_EMAIL'),
    password: resolveValue('manager-password', 'BOOTSTRAP_MANAGER_PASSWORD'),
    name: resolveValue('manager-name', 'BOOTSTRAP_MANAGER_NAME'),
  })

  if (!admin && !manager) {
    console.log('No bootstrap users configured. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create a real admin account.')
    return
  }

  if (admin) {
    console.log(`Bootstrap admin ready: ${admin.email}`)
  }

  if (manager) {
    console.log(`Bootstrap manager ready: ${manager.email}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
