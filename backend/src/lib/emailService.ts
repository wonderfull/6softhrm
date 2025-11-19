import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

// Verify transporter configuration
export async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('⚠️  Email not configured. Set SMTP_USER and SMTP_PASSWORD in .env')
    return false
  }
  
  try {
    await transporter.verify()
    console.log('✅ Email service ready')
    return true
  } catch (error) {
    console.error('❌ Email service error:', error)
    return false
  }
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

// Send email
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('Email not sent - SMTP not configured')
    return false
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || '6Soft HRM'}" <${process.env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
      html: options.html,
    })
    
    console.log('✉️  Email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

// Email templates
export const EmailTemplates = {
  visaExpiry: (employeeName: string, visaType: string, expiryDate: string, daysRemaining: number) => ({
    subject: `⚠️ Visa Expiry Alert: ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ Visa Expiry Alert</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            <strong>Employee:</strong> ${employeeName}<br>
            <strong>Visa Type:</strong> ${visaType}<br>
            <strong>Expiry Date:</strong> ${expiryDate}<br>
            <strong>Days Remaining:</strong> ${daysRemaining}
          </p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;">
              <strong>Action Required:</strong> Please renew or update visa documentation before expiry.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM. Please login to the system to update records.
          </p>
        </div>
      </div>
    `,
  }),

  contractExpiry: (employeeName: string, expiryDate: string, daysRemaining: number) => ({
    subject: `⚠️ Contract Expiry Alert: ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ Contract Expiry Alert</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            <strong>Employee:</strong> ${employeeName}<br>
            <strong>Contract End Date:</strong> ${expiryDate}<br>
            <strong>Days Remaining:</strong> ${daysRemaining}
          </p>
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Action Required:</strong> Review and renew employment contract before expiry.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM. Please login to the system to update records.
          </p>
        </div>
      </div>
    `,
  }),

  leaveRequestPending: (employeeName: string, leaveType: string, startDate: string, endDate: string, requestId: number) => ({
    subject: `📋 Leave Request Pending Approval: ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📋 Leave Request Pending</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            <strong>Employee:</strong> ${employeeName}<br>
            <strong>Leave Type:</strong> ${leaveType}<br>
            <strong>Start Date:</strong> ${startDate}<br>
            <strong>End Date:</strong> ${endDate}
          </p>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Action Required:</strong> Please review and approve/reject this leave request.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM. Please login to the system to process this request.
          </p>
        </div>
      </div>
    `,
  }),

  leaveRequestApproved: (employeeName: string, leaveType: string, startDate: string, endDate: string) => ({
    subject: `✅ Leave Request Approved`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">✅ Leave Request Approved</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            Dear ${employeeName},
          </p>
          <p style="font-size: 16px; color: #111827;">
            Your leave request has been approved:
          </p>
          <p style="font-size: 16px; color: #111827;">
            <strong>Leave Type:</strong> ${leaveType}<br>
            <strong>Start Date:</strong> ${startDate}<br>
            <strong>End Date:</strong> ${endDate}
          </p>
          <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46;">
              Your leave has been approved. Enjoy your time off!
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM.
          </p>
        </div>
      </div>
    `,
  }),

  leaveRequestRejected: (employeeName: string, leaveType: string, startDate: string, endDate: string, reason?: string) => ({
    subject: `❌ Leave Request Rejected`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">❌ Leave Request Rejected</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            Dear ${employeeName},
          </p>
          <p style="font-size: 16px; color: #111827;">
            Your leave request has been rejected:
          </p>
          <p style="font-size: 16px; color: #111827;">
            <strong>Leave Type:</strong> ${leaveType}<br>
            <strong>Start Date:</strong> ${startDate}<br>
            <strong>End Date:</strong> ${endDate}
          </p>
          ${reason ? `
          <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;">
              <strong>Reason:</strong> ${reason}
            </p>
          </div>
          ` : ''}
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM. Please contact your manager for more information.
          </p>
        </div>
      </div>
    `,
  }),

  welcomeNewEmployee: (employeeName: string, email: string, startDate: string) => ({
    subject: `Welcome to the Team! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎉 Welcome to 6Soft!</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            Dear ${employeeName},
          </p>
          <p style="font-size: 16px; color: #111827;">
            Welcome to the team! Your employee account has been created.
          </p>
          <p style="font-size: 16px; color: #111827;">
            <strong>Email:</strong> ${email}<br>
            <strong>Start Date:</strong> ${startDate}
          </p>
          <div style="background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #5b21b6;">
              <strong>Next Steps:</strong> Please check your email for login credentials and onboarding information.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            We're excited to have you on board! If you have any questions, please contact HR.
          </p>
        </div>
      </div>
    `,
  }),

  documentUploaded: (employeeName: string, documentName: string, uploadedBy: string) => ({
    subject: `📄 New Document Uploaded: ${documentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #06b6d4; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📄 New Document Uploaded</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">
            Dear ${employeeName},
          </p>
          <p style="font-size: 16px; color: #111827;">
            A new document has been uploaded to your employee record:
          </p>
          <p style="font-size: 16px; color: #111827;">
            <strong>Document:</strong> ${documentName}<br>
            <strong>Uploaded By:</strong> ${uploadedBy}
          </p>
          <div style="background: #cffafe; border-left: 4px solid #06b6d4; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #164e63;">
              Please login to the HRM system to view this document.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from 6Soft HRM.
          </p>
        </div>
      </div>
    `,
  }),
}
