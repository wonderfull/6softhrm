import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

if ((process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

const prisma = new PrismaClient()

export default prisma
