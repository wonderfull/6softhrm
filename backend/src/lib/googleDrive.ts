import { google } from 'googleapis'
import dotenv from 'dotenv'
import prisma from '../prismaClient'
import fs from 'fs'

dotenv.config()

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata']

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || ''
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(state?: string) {
  const oAuth2Client = createOAuth2Client()
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  })
  return url
}

export async function exchangeCodeAndSave(code: string, userId: number) {
  const oAuth2Client = createOAuth2Client()
  const { tokens } = await oAuth2Client.getToken(code)
  if (!tokens.refresh_token) {
    // If refresh_token is missing, it may be because consent was not granted; still store access token
  }

  // upsert into GoogleAccount table linked to user
  const existing = await prisma.googleAccount.findUnique({ where: { userId } })
  if (existing) {
    await prisma.googleAccount.update({ where: { userId }, data: { refreshToken: tokens.refresh_token || existing.refreshToken, accessToken: tokens.access_token, scope: tokens.scope, expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined } })
  } else {
    await prisma.googleAccount.create({ data: { userId, refreshToken: tokens.refresh_token || '', accessToken: tokens.access_token, scope: tokens.scope, expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined } })
  }

  return tokens
}

async function getOAuthClientForUser(userId: number) {
  const acct = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!acct) return null
  const oAuth2Client = createOAuth2Client()
  oAuth2Client.setCredentials({ refresh_token: acct.refreshToken, access_token: acct.accessToken, expiry_date: acct.expiry ? acct.expiry.getTime() : undefined })
  return oAuth2Client
}

export async function uploadFileToDrive(userId: number, filePath: string, filename: string) {
  const auth = await getOAuthClientForUser(userId)
  if (!auth) throw new Error('No Google account connected')

  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.create({
    requestBody: { name: filename },
    media: { body: fs.createReadStream(filePath) },
    fields: 'id, webViewLink, webContentLink',
  })

  return res.data
}
