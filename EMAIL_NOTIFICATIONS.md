# Email Notification System Setup Guide

This guide explains how to configure and use the automated email notification system in 6Soft HRM.

## Features

The email notification system provides automated alerts for:

✅ **Visa/Sponsorship Expiry Alerts** - Notifies admins and employees 30, 60, and 90 days before visa expiration  
✅ **Contract Expiry Alerts** - Notifies admins and employees 30, 60, and 90 days before contract end date  
✅ **Leave Request Notifications** - Notifies managers when employees request leave  
✅ **Leave Approval/Rejection** - Notifies employees when their leave is approved or rejected  
✅ **Document Upload Notifications** - Notifies employees when new documents are uploaded  
✅ **Welcome Emails** - Sends welcome email to new employees

## Setup Instructions

### 1. Configure SMTP Settings

The system uses SMTP to send emails. You need to configure your email provider settings in the backend `.env` file.

#### Option A: Gmail (Recommended for Development)

1. Go to your Google Account settings: https://myaccount.google.com
2. Enable 2-Factor Authentication (2FA) if not already enabled
3. Generate an App Password:
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other" as the device and name it "6Soft HRM"
   - Copy the 16-character password generated
4. Update your `backend/.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_NAME=6Soft HRM
```

#### Option B: Microsoft 365 / Outlook

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-password
SMTP_FROM_NAME=6Soft HRM
```

#### Option C: Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM_NAME=6Soft HRM
```

**Note:** Set `SMTP_SECURE=true` if using port 465 (SSL/TLS).

### 2. Restart Backend Server

After configuring SMTP settings, restart the backend server:

```bash
cd backend
npm run dev
```

The server will verify your email configuration on startup. Look for this message:

```
✅ Email service configured successfully
📧 Ready to send emails from: your-email@gmail.com
```

If configuration fails, you'll see an error message with details.

### 3. Test Email Configuration

1. Login to 6Soft HRM as an admin
2. Navigate to **Notifications** page in the sidebar
3. Enter your email address in the "Test Email" field
4. Click **📧 Test Email** button
5. Check your inbox for a test email

If you don't receive the test email:

- Check your spam/junk folder
- Verify SMTP credentials are correct
- Check backend server logs for error messages
- Ensure 2FA and App Password are set up correctly (for Gmail)

## Automated Daily Checks

The system runs an automated task **daily at 9:00 AM UK time** to check for:

- Visas expiring in 30, 60, or 90 days
- Contracts expiring in 30, 60, or 90 days

Notifications are automatically sent to:

- All users with ADMIN or MANAGER role
- The affected employee

### Manual Expiry Check

Admins can trigger a manual check at any time:

1. Navigate to **Notifications** page
2. Click **🔔 Check & Send Notifications** button
3. Confirm the action
4. View results showing how many notifications were sent

## Email Templates

### 1. Visa Expiry Alert

**Trigger:** Visa expires in 30/60/90 days  
**Recipients:** Admins, Managers, Employee  
**Subject:** `⚠️ Visa Expiry Alert: [Employee Name]`  
**Contains:** Employee name, visa type, expiry date, days remaining

### 2. Contract Expiry Alert

**Trigger:** Contract ends in 30/60/90 days  
**Recipients:** Admins, Managers, Employee  
**Subject:** `⚠️ Contract Expiry Alert: [Employee Name]`  
**Contains:** Employee name, job title, end date, days remaining

### 3. Leave Request Pending

**Trigger:** Employee submits leave request  
**Recipients:** Admins, Managers  
**Subject:** `📋 Leave Request Pending Approval: [Employee Name]`  
**Contains:** Employee name, leave type, start date, end date, reason

### 4. Leave Request Approved

**Trigger:** Manager approves leave request  
**Recipients:** Employee  
**Subject:** `✅ Leave Request Approved`  
**Contains:** Leave type, start date, end date

### 5. Leave Request Rejected

**Trigger:** Manager rejects leave request  
**Recipients:** Employee  
**Subject:** `❌ Leave Request Rejected`  
**Contains:** Leave type, start date, end date, rejection reason

### 6. Document Uploaded

**Trigger:** Admin uploads document for employee  
**Recipients:** Employee  
**Subject:** `📄 New Document Available`  
**Contains:** Document name, type, upload date

### 7. Welcome New Employee

**Trigger:** New employee created  
**Recipients:** Employee  
**Subject:** `Welcome to the Team! 🎉`  
**Contains:** Welcome message, employee email, start date

## Integration with Workflows

### Leave Requests

- **Create Request:** Automatically notifies all admins/managers
- **Approve Request:** Automatically notifies employee of approval
- **Reject Request:** Automatically notifies employee of rejection (include reason in request body)

### Document Management

- When uploading documents, call the notification endpoint:

```javascript
POST /api/notifications/notify-document-upload
{
  "employeeId": 123,
  "documentName": "Employment Contract",
  "documentType": "CONTRACT"
}
```

### Employee Onboarding

- When creating a new employee, send welcome email:

```javascript
// Use EmailTemplates.welcomeNewEmployee in your code
```

## Viewing Upcoming Expiries

Admins can view all upcoming expiries on the **Notifications** page:

1. Navigate to **Notifications** in the sidebar
2. Select time range: 30, 60, 90, or 180 days
3. View two sections:
   - **🛂 Visa Expiries** - Shows all visas expiring in selected period
   - **📄 Contract Expiries** - Shows all contracts ending in selected period

Each item displays:

- Employee name and email
- Visa type or job title
- Expiry/end date
- Days remaining (color-coded: red ≤30, orange ≤60, yellow ≤90)

## Troubleshooting

### No emails are being sent

**Check:**

1. ✅ SMTP configuration is correct in `.env`
2. ✅ Backend server restarted after changing `.env`
3. ✅ Test email button works
4. ✅ Check backend logs for error messages
5. ✅ Verify email provider allows SMTP connections
6. ✅ Check firewall/network restrictions

### Gmail App Password not working

**Solutions:**

1. Ensure 2FA is enabled on your Google account
2. Generate a new App Password
3. Use the 16-character password without spaces
4. Don't use your regular Gmail password
5. Make sure you selected "Mail" when generating the App Password

### Emails going to spam

**Solutions:**

1. Add sender email to your contacts
2. Mark test email as "Not Spam"
3. For production: Configure SPF, DKIM, and DMARC records for your domain
4. Use a professional email address (not @gmail.com) in production

### Cron job not running

**Check:**

1. Server is running continuously (not restarting)
2. Backend logs show: `[CRON] Scheduled daily expiry check at 9:00 AM UK time`
3. Server timezone is correct
4. No errors in backend logs at 9:00 AM

**Test cron job manually:**

```typescript
// In backend/src/lib/cronJobs.ts, uncomment this line:
checkExpiringRecords();
```

This will run the expiry check immediately when server starts.

### Missing email addresses

**Emails won't be sent if:**

- Employee record has no email address
- User record has no email address
- Email field is empty or invalid

**Solution:** Ensure all employees and users have valid email addresses in their profiles.

## Production Deployment

### Security Recommendations

1. **Use dedicated SMTP credentials** - Create a separate email account for sending notifications
2. **Secure environment variables** - Never commit `.env` file to git
3. **Use strong passwords** - Use complex passwords or app-specific passwords
4. **Enable TLS/SSL** - Use secure SMTP connections (port 587 with STARTTLS or port 465 with SSL)
5. **Monitor email logs** - Regularly check backend logs for failed email attempts

### Email Service Providers

For production, consider using:

- **SendGrid** - Reliable, scalable, free tier available
- **Mailgun** - Developer-friendly, good deliverability
- **Amazon SES** - Cost-effective, requires AWS account
- **Microsoft 365** - Professional, good for business domains
- **Custom SMTP** - Use your company's email server

### Rate Limiting

Be aware of email provider limits:

- **Gmail:** 500 emails/day, 100 recipients per email
- **SendGrid Free:** 100 emails/day
- **Mailgun Free:** 100 emails/day
- **Amazon SES:** Based on usage, pay-as-you-go

### Email Deliverability

To improve deliverability in production:

1. **Use a professional domain** - Don't use @gmail.com for company emails
2. **Configure SPF record** - Add to DNS: `v=spf1 include:_spf.google.com ~all` (for Gmail)
3. **Configure DKIM** - Enable in email provider settings
4. **Configure DMARC** - Add to DNS: `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com`
5. **Warm up your domain** - Start with low volume, gradually increase
6. **Monitor bounce rates** - Remove invalid email addresses
7. **Provide unsubscribe option** - Allow users to opt-out of non-critical notifications

## Environment Variables Reference

| Variable         | Required | Default          | Description                                         |
| ---------------- | -------- | ---------------- | --------------------------------------------------- |
| `SMTP_HOST`      | Yes      | `smtp.gmail.com` | SMTP server hostname                                |
| `SMTP_PORT`      | Yes      | `587`            | SMTP server port (587 for STARTTLS, 465 for SSL)    |
| `SMTP_SECURE`    | Yes      | `false`          | Use SSL/TLS (true for port 465, false for port 587) |
| `SMTP_USER`      | Yes      | -                | Email address to send from                          |
| `SMTP_PASSWORD`  | Yes      | -                | Email password or app-specific password             |
| `SMTP_FROM_NAME` | No       | `6Soft HRM`      | Display name for sent emails                        |

## API Endpoints

### Check Expiries (Manual)

```
POST /api/notifications/check-expiries
Authorization: Bearer <token>
```

Checks and sends notifications for expiring visas/contracts.

### Get Upcoming Expiries

```
GET /api/notifications/upcoming-expiries?days=90
Authorization: Bearer <token>
```

Returns list of upcoming expiries (no emails sent).

### Test Email

```
POST /api/notifications/test-email
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "test@example.com"
}
```

Sends a test email to verify SMTP configuration.

### Notify Leave Request

```
POST /api/notifications/notify-leave-request
Authorization: Bearer <token>
Content-Type: application/json

{
  "leaveRequestId": 123
}
```

Sends leave request notification to admins/managers.

### Notify Leave Status

```
POST /api/notifications/notify-leave-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "leaveRequestId": 123,
  "status": "APPROVED",
  "reason": "Optional rejection reason"
}
```

Sends leave approval/rejection notification to employee.

### Notify Document Upload

```
POST /api/notifications/notify-document-upload
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeId": 123,
  "documentName": "Employment Contract",
  "documentType": "CONTRACT"
}
```

Sends document upload notification to employee.

## Support

For issues or questions:

1. Check backend server logs for error messages
2. Review this documentation
3. Test with the "Test Email" button
4. Verify SMTP configuration
5. Contact system administrator

## Compliance Notes

This notification system supports UK GDPR compliance by:

- ✅ Providing automated reminders for visa and contract renewals
- ✅ Maintaining audit trail of notifications (check backend logs)
- ✅ Using secure email protocols (TLS/SSL)
- ✅ Not storing email content in database
- ✅ Allowing admins to manually trigger checks

For data retention and privacy policies, refer to `GDPR_COMPLIANCE.md`.
