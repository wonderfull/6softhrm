# GDPR Compliance Implementation

## Overview

This document describes the UK GDPR compliance features implemented in the 6Soft HRM system.

## Features Implemented

### 1. Audit Logging (Article 30 - Records of Processing)

All data access and modifications are logged with:

- User ID and email
- Action performed (LOGIN, CREATE, READ, UPDATE, DELETE, DATA_EXPORT, etc.)
- Entity and entity ID affected
- Timestamp
- IP address
- User agent (browser/device info)
- Additional context details

**Implementation:**

- Database: `AuditLog` model in `backend/prisma/schema.prisma`
- Middleware: `backend/src/middleware/audit.ts` - Non-blocking audit logging
- Routes: Integrated into all data-handling routes (auth, employees, documents, etc.)
- Frontend: Admin audit log viewer at `/audit-logs`

**API Endpoints:**

- `GET /api/gdpr/audit-logs` - View audit logs (admin only)
  - Query params: `entity`, `action`, `limit`, `offset`, `userId`

### 2. Subject Access Requests (Article 15 - Right of Access)

Employees can request all their personal data held by the organization.

**Exports Include:**

- Personal information (name, email, phone, address)
- Employment details (job title, department, start date)
- Financial data (bank details, NI number) - securely handled
- Timesheets and project assignments
- Leave requests and approvals
- Documents uploaded
- Recent audit logs (up to 1000)
- Consent history

**Implementation:**

- Routes: `backend/src/routes/gdpr.ts`
- Frontend: Data Export page at `/data-export`

**API Endpoints:**

- `GET /api/gdpr/subject-access-request/:employeeId` - Export all data as JSON
- `GET /api/gdpr/export-employee-data/:employeeId` - Export as Excel workbook

**Access Control:**

- Admin users can export any employee's data
- Regular users can only export their own data
- All exports are logged in audit trail

### 3. Data Consent Management (Article 7 - Conditions for Consent)

Track and manage consent for data processing activities.

**Consent Types Tracked:**

- Data processing
- Marketing communications
- Third-party sharing
- Any custom consent requirements

**Implementation:**

- Database: `DataConsent` model tracks consent history
- Each consent record includes:
  - Employee ID
  - Consent type
  - Whether given or withdrawn
  - Date of consent/withdrawal
  - IP address of action
  - Version number (for policy changes)

**API Endpoints:**

- `POST /api/gdpr/consent` - Record new consent or withdrawal
- `GET /api/gdpr/consent/:employeeId` - View consent history

### 4. Right to Erasure (Article 17)

Employees can be deleted from the system. Deletion includes:

- Employee record
- Associated timesheets
- Leave requests
- Documents
- Sponsorships
- All related data

**Note:** Audit logs are retained for legal compliance even after employee deletion.

## Technical Architecture

### Database Schema

```prisma
model AuditLog {
  id         Int       @id @default(autoincrement())
  userId     Int?
  userEmail  String?
  action     String
  entity     String
  entityId   Int?
  details    Json?
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime  @default(now())
}

model DataConsent {
  id           Int       @id @default(autoincrement())
  employeeId   Int
  employee     Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  consentType  String
  consentGiven Boolean
  consentDate  DateTime?
  withdrawnDate DateTime?
  ipAddress    String?
  version      String?
  createdAt    DateTime  @default(now())
}
```

### Audit Middleware

Non-blocking audit logging ensures:

- Application doesn't fail if audit logging fails
- All operations complete successfully
- Comprehensive logging without performance impact

```typescript
// Usage in routes
await auditLog(req, 'CREATE', 'Employee', emp.id, {
  firstName: emp.firstName,
  lastName: emp.lastName,
});
```

### Access Control

- Audit logs: Admin only
- Data export: Admin or self
- Consent management: Admin or self
- All access is logged

## Compliance Checklist

### ✅ Implemented

- [x] Audit logging for all data access and modifications
- [x] Subject access request (data export) functionality
- [x] Data consent tracking and management
- [x] Right to erasure (delete employee with cascade)
- [x] Data minimization (collect only necessary data)
- [x] Access controls (role-based permissions)
- [x] Secure password storage (bcrypt hashing)
- [x] HTTPS support ready (configure in production)
- [x] Audit log viewer for admins
- [x] Excel and JSON export formats

### 🔄 Partially Implemented

- [ ] Privacy notice display and acknowledgment (backend ready, UI pending)
- [ ] Data retention policies (manual process, automation pending)
- [ ] Automated consent renewal reminders

### ⏳ Recommended Future Enhancements

- [ ] Anonymization tools for historical data
- [ ] Automated data breach notification system
- [ ] Data Processing Impact Assessment (DPIA) tools
- [ ] Cookie consent management
- [ ] Third-party data sharing agreements tracking
- [ ] Scheduled data retention cleanup jobs
- [ ] Encrypted backups with key management
- [ ] Two-factor authentication (2FA)

## Security Measures

### Implemented

1. **Authentication**: JWT tokens with 8-hour expiry
2. **Authorization**: Role-based access control (ADMIN, MANAGER, USER)
3. **Password Security**: bcrypt hashing with salt
4. **SQL Injection Protection**: Prisma ORM parameterized queries
5. **CORS**: Restricted to specific origins
6. **Audit Trail**: All actions logged with user, timestamp, IP
7. **Data Validation**: Input validation on all endpoints

### Production Recommendations

1. Enable HTTPS (TLS/SSL certificates)
2. Configure secure cookies (httpOnly, secure, sameSite)
3. Set up rate limiting on API endpoints
4. Enable database encryption at rest
5. Regular security audits
6. Implement Content Security Policy (CSP) headers
7. Regular backup and disaster recovery testing

## Data Processing Activities

### Lawful Basis (Article 6)

- **Contract Performance**: Employment contract execution
- **Legal Obligation**: Tax, payroll, employment law compliance
- **Legitimate Interest**: HR administration, security
- **Consent**: Marketing, optional data processing

### Data Categories Processed

1. **Identity Data**: Name, email, phone, employee ID
2. **Financial Data**: Bank details, NI number, salary
3. **Employment Data**: Job title, department, start date, projects
4. **Time & Attendance**: Timesheets, leave requests
5. **Documents**: Contracts, certifications, HR documents
6. **Technical Data**: IP address, login history, device info

## Retention Policy

### Recommended Retention Periods

- **Active Employees**: Data retained while employed
- **Former Employees**:
  - Tax records: 6 years (HMRC requirement)
  - Payroll: 3 years minimum
  - Timesheets: 2 years
  - General HR: 6 years from employment end
- **Audit Logs**: 2 years minimum, 7 years recommended
- **Consent Records**: Duration of processing + 7 years

### Implementation

Currently manual. Recommended to implement automated cleanup jobs.

## Data Subject Rights

### Implemented Rights

1. **Right of Access** (Article 15): Subject access request exports ✅
2. **Right to Rectification** (Article 16): Employee update functionality ✅
3. **Right to Erasure** (Article 17): Employee deletion with cascade ✅
4. **Right to Data Portability** (Article 20): JSON/Excel exports ✅
5. **Right to Object** (Article 21): Consent withdrawal ✅

### Response Timeline

- Subject access requests: 30 days (automated export available immediately)
- Rectification requests: Within 5 business days
- Erasure requests: Within 30 days (can be immediate via admin)

## Training Requirements

### Admin Users Must Know

1. How to handle subject access requests
2. When to export employee data
3. How to review audit logs
4. Proper data deletion procedures
5. Incident response procedures

### All Users Must Know

1. Their data privacy rights
2. How to request their data
3. How to update their information
4. Company privacy policy
5. Data breach reporting procedures

## Testing GDPR Features

### Manual Tests

1. **Login Audit**: Check `/audit-logs` after login - should show LOGIN_SUCCESS
2. **Employee CRUD**: Create/update/delete employee - check audit logs
3. **Data Export**: Export employee data - verify all information included
4. **Access Control**: Non-admin tries to access audit logs - should be denied
5. **Self-Service**: Regular user exports own data - should succeed
6. **Consent Tracking**: Record consent - verify in database

### API Tests

```bash
# Login and get token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin"}'

# View audit logs (admin only)
curl -X GET "http://localhost:4000/api/gdpr/audit-logs?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Export employee data
curl -X GET "http://localhost:4000/api/gdpr/subject-access-request/1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Record consent
curl -X POST http://localhost:4000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":1,"consentType":"data_processing","consentGiven":true,"version":"1.0"}'
```

## Incident Response

### Data Breach Procedure

1. **Identify**: Detect and confirm the breach
2. **Contain**: Stop the breach, secure systems
3. **Assess**: Determine scope, affected data, risk level
4. **Notify**: ICO within 72 hours if high risk
5. **Notify Individuals**: If high risk to their rights
6. **Document**: Record in audit log, create incident report
7. **Review**: Update security measures

### Breach Notification Requirements

- **ICO Notification**: Within 72 hours
- **Individual Notification**: Without undue delay if high risk
- **Documentation**: All breaches logged, even if not reported

## Compliance Contacts

### Data Protection Officer (DPO)

- To be appointed if required by organization
- Recommended for organizations processing sensitive data at scale

### ICO (Supervisory Authority)

- Website: https://ico.org.uk
- Phone: 0303 123 1113
- Email: casework@ico.org.uk

## Next Steps

### Priority 1 (Critical)

- [x] Audit logging - COMPLETE
- [x] Subject access requests - COMPLETE
- [x] Data consent tracking - COMPLETE

### Priority 2 (Important)

- [ ] Privacy notice UI with acknowledgment
- [ ] Automated data retention cleanup
- [ ] Consent renewal reminders

### Priority 3 (Recommended)

- [ ] Two-factor authentication
- [ ] Encrypted database backups
- [ ] Security audit and penetration testing
- [ ] Staff GDPR training program
- [ ] Data Processing Impact Assessments

## Documentation Updates

This GDPR implementation should be reflected in:

1. Privacy Policy - Update with new data processing activities
2. Employee Handbook - Add data rights information
3. Security Policy - Add GDPR compliance measures
4. Training Materials - Include GDPR awareness training

## Monitoring & Review

### Regular Reviews

- **Monthly**: Audit log review for suspicious activity
- **Quarterly**: Data retention compliance check
- **Annually**: Full GDPR compliance audit
- **As Needed**: Privacy notice updates, policy changes

### Metrics to Track

- Subject access request response times
- Data breach incidents (should be zero)
- Consent withdrawal rates
- Audit log anomalies
- User access patterns

---

**Last Updated**: November 2024  
**Version**: 1.0  
**Author**: 6Soft Development Team  
**Review Date**: February 2025
