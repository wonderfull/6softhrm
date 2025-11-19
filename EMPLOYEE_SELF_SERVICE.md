# Employee Self-Service Implementation

## Overview
This update enables employees to use the HRM system with restricted access to only their own data. Employees can now request leave and view their personal information, while admins/managers retain full access to all data.

## Database Changes

### Schema Updates
- Added `employeeId` field to the `User` model to link user accounts to employee records
- Created relationship between `User` and `Employee` models
- Migration: `20251119141150_add_employee_link_to_user`

### Data Linking
- Created tool to automatically link existing users to employees by matching email addresses
- Located at: `backend/tools/link-users-to-employees.js`
- Successfully linked 2 users to employee records

## Backend Changes

### Authentication (`backend/src/routes/auth.ts`)
- Updated login endpoint to include `employeeId` in JWT token payload
- Updated users list endpoint to include linked employee information
- JWT now contains: `{ id, email, role, employeeId }`

### Leave Management (`backend/src/routes/leave.ts`)
- **GET /leave**: Employees see only their own leave requests, admins/managers see all
- **POST /leave**: Employees can create leave requests for themselves (employeeId automatically set)
- Employees must be linked to an employee record to request leave

### Documents (`backend/src/routes/documents.ts`)
- **GET /documents**: Employees see only their own documents, admins see all
- **GET /documents/expiring**: Filtered by employee for USER role

### Sponsorships (`backend/src/routes/sponsorships.ts`)
- **GET /sponsorships/expiring**: Filtered by employee for USER role
- Dashboard alerts show only relevant sponsorships per user

### Timesheets (`backend/src/routes/timesheets.ts`)
- **GET /timesheets**: Employees see only their own timesheets
- **POST /timesheets**: Employees can create timesheets for themselves
- **GET /timesheets/export/excel**: Export filtered by employee role

## Frontend Changes

### Leave Requests (`frontend/src/pages/Leave.tsx`)
- Added "Request Leave" button for employees
- New form for employees to submit leave requests with:
  - Leave type selection (Annual, Sick, Personal, Unpaid)
  - Start and end date pickers
  - Optional reason field
- Improved UI with Card components
- Status badges (PENDING/APPROVED/REJECTED)
- Approve/Reject buttons visible only to admins/managers

### User Management (`frontend/src/pages/Users.tsx`)
- Shows linked employee information on user cards
- Visual indicator if user is linked to employee record
- Warning icon if user is not linked to employee
- Fixed button responsiveness after user creation

### Dashboard (`frontend/src/pages/Dashboard.tsx`)
- Already fetches expiring documents and sponsorships
- Backend now automatically filters alerts by employee role
- Employees see only their own expiring documents/sponsorships

## User Roles & Permissions

### Employee (USER role)
**Can:**
- View their own leave requests
- Submit new leave requests
- View their own documents
- View their own timesheets
- Create timesheets for themselves
- View their own sponsorships
- See dashboard alerts for their own expiring items

**Cannot:**
- Approve/reject leave requests
- View other employees' data
- Manage users
- Access admin functions

### Manager (MANAGER role)
**Can:**
- Everything an employee can do
- Approve/reject leave requests
- View all employees' data
- Manage leave requests

### Admin (ADMIN role)
**Can:**
- Full access to all features
- Manage users
- View and manage all employee data
- Approve/reject leave requests
- Access all admin functions

## Setup Instructions

### For Existing Installations

1. **Run Migration**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Link Existing Users to Employees**
   ```bash
   cd backend
   node tools/link-users-to-employees.js
   ```
   This will automatically link users to employees by matching email addresses.

3. **Create Employee User Accounts**
   For employees who need system access:
   - Go to User Management
   - Create a new user with email matching the employee record
   - Set role as "Employee (USER)"
   - The system will automatically link them on next login, or run the linking tool

### For New Employee Users

1. Admin creates employee record in Employees section
2. Admin creates user account in User Management with:
   - Same email as employee record
   - Role: "Employee (USER)"
3. System automatically links them by email
4. Employee can now login and access their data

## Testing Checklist

- [x] Employee can login and see dashboard
- [x] Employee sees only their own data in all sections
- [x] Employee can submit leave requests
- [x] Admin can approve/reject leave requests
- [x] Dashboard alerts filtered by employee
- [x] Timesheets filtered by employee
- [x] Documents filtered by employee
- [x] User creation button responsive
- [x] Employee information shown on user cards

## Security Notes

- All routes use `requireAuth` middleware
- Employee data filtering happens at the backend level
- JWT tokens include employeeId for efficient filtering
- Users without linked employee records receive appropriate error messages
- Role-based access control enforced on all sensitive operations

## Future Enhancements

Potential improvements:
- Allow employees to upload their own documents
- Enable employees to edit their personal information
- Add leave balance tracking
- Implement leave approval workflow with notifications
- Add calendar view for employee's own schedule
- Mobile-responsive employee portal
