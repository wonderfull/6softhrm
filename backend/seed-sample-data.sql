-- Sample Data for 6Soft HRM Development Database
-- Run with: mysql -u root -pNetscape99 sixsoft_hrm < seed-sample-data.sql

-- Insert Sample Employees
INSERT INTO Employee (firstName, lastName, email, phoneNumber, niNumber, jobTitle, employeeType, department, startDate, bankName, accountNumber, sortCode, emergencyContactName, emergencyContactPhone, emergencyContactRelation, emergencyContactAddress) VALUES
('John', 'Smith', 'john.smith@company.com', '+44 7700 900001', 'AB123456C', 'Senior Developer', 'EMPLOYEE', 'Engineering', '2023-01-15 00:00:00', 'Barclays', '12345678', '20-00-00', 'Jane Smith', '+44 7700 900002', 'Spouse', '123 High Street, London, SW1A 1AA'),
('Sarah', 'Johnson', 'sarah.johnson@company.com', '+44 7700 900003', 'CD234567D', 'Product Manager', 'EMPLOYEE', 'Product', '2023-03-20 00:00:00', 'HSBC', '23456789', '40-00-00', 'Mike Johnson', '+44 7700 900004', 'Spouse', '456 Park Lane, Manchester, M1 1AA'),
('Michael', 'Brown', 'michael.brown@company.com', '+44 7700 900005', 'EF345678E', 'UX Designer', 'EMPLOYEE', 'Design', '2023-06-10 00:00:00', 'Lloyds', '34567890', '30-00-00', 'Emma Brown', '+44 7700 900006', 'Partner', '789 Queen Street, Birmingham, B1 1AA'),
('Emily', 'Davis', 'emily.davis@company.com', '+44 7700 900007', 'GH456789F', 'HR Manager', 'EMPLOYEE', 'Human Resources', '2022-09-01 00:00:00', 'NatWest', '45678901', '60-00-00', 'Tom Davis', '+44 7700 900008', 'Brother', '321 King Road, Leeds, LS1 1AA'),
('David', 'Wilson', 'david.wilson@company.com', '+44 7700 900009', 'IJ567890G', 'Chief Technology Officer', 'DIRECTOR', 'Executive', '2021-04-01 00:00:00', 'Barclays', '56789012', '20-00-00', 'Lisa Wilson', '+44 7700 900010', 'Spouse', '654 Prince Street, Edinburgh, EH1 1AA'),
('James', 'Taylor', 'james.taylor@company.com', '+44 7700 900011', 'KL678901H', 'Junior Developer', 'EMPLOYEE', 'Engineering', '2024-02-01 00:00:00', 'Santander', '67890123', '09-00-00', 'Mary Taylor', '+44 7700 900012', 'Mother', '987 Duke Avenue, Bristol, BS1 1AA');

-- Insert Sample Projects
INSERT INTO Project (code, name, description, active, createdAt) VALUES
('HRMS', 'HR Management System', 'Internal HR system development', 1, '2023-01-01 00:00:00'),
('WEBAPP', 'Customer Web Portal', 'Public-facing customer portal', 1, '2023-02-15 00:00:00'),
('MOBILE', 'Mobile App Development', 'iOS and Android mobile applications', 1, '2023-04-01 00:00:00'),
('API', 'API Integration', 'Third-party API integration project', 1, '2023-05-10 00:00:00'),
('LEGACY', 'Legacy System Maintenance', 'Maintaining old systems', 0, '2022-01-01 00:00:00');

-- Insert Sample Timesheets (last 2 weeks)
INSERT INTO Timesheet (employeeId, projectId, date, hours, notes) VALUES
-- John Smith's timesheets
(1, 1, '2025-11-18 00:00:00', 8, 'Working on employee module'),
(1, 1, '2025-11-19 00:00:00', 7.5, 'Bug fixes and testing'),
(1, 1, '2025-11-15 00:00:00', 8, 'Code review and documentation'),
(1, 2, '2025-11-14 00:00:00', 6, 'Frontend development'),
(1, 1, '2025-11-13 00:00:00', 8, 'Database optimization'),
-- Sarah Johnson's timesheets
(2, 2, '2025-11-18 00:00:00', 8, 'Sprint planning and backlog grooming'),
(2, 2, '2025-11-19 00:00:00', 7, 'Stakeholder meetings'),
(2, 3, '2025-11-15 00:00:00', 8, 'Mobile app requirements'),
(2, 2, '2025-11-14 00:00:00', 8, 'User story creation'),
-- Michael Brown's timesheets
(3, 2, '2025-11-18 00:00:00', 8, 'UI mockups for portal'),
(3, 3, '2025-11-19 00:00:00', 7.5, 'Mobile app design'),
(3, 2, '2025-11-15 00:00:00', 8, 'Design system updates'),
(3, 2, '2025-11-14 00:00:00', 6, 'User research'),
-- James Taylor's timesheets
(6, 1, '2025-11-18 00:00:00', 8, 'Learning codebase'),
(6, 1, '2025-11-19 00:00:00', 7, 'Pair programming with senior dev'),
(6, 4, '2025-11-15 00:00:00', 8, 'API documentation'),
(6, 1, '2025-11-14 00:00:00', 8, 'Unit tests');

-- Insert Sample Leave Requests
INSERT INTO LeaveRequest (employeeId, type, startDate, endDate, status, reason) VALUES
(1, 'Annual Leave', '2025-12-23 00:00:00', '2025-12-27 00:00:00', 'PENDING', 'Christmas holiday'),
(2, 'Sick Leave', '2025-11-10 00:00:00', '2025-11-11 00:00:00', 'APPROVED', 'Flu'),
(3, 'Annual Leave', '2026-01-06 00:00:00', '2026-01-10 00:00:00', 'PENDING', 'New Year break'),
(4, 'Annual Leave', '2025-11-25 00:00:00', '2025-11-29 00:00:00', 'APPROVED', 'Family visit'),
(6, 'Personal Leave', '2025-12-15 00:00:00', '2025-12-15 00:00:00', 'PENDING', 'Personal appointment');

-- Insert Sample Sponsorships (for international employees)
INSERT INTO Sponsorship (employeeId, visaType, casNumber, sponsorLicenseNumber, startDate, endDate, complianceNotes, active) VALUES
(3, 'Skilled Worker Visa', 'CAS1234567890', 'SPNSR123456', '2023-06-01 00:00:00', '2026-06-01 00:00:00', 'All UKVI requirements met. Annual checks completed.', 1),
(6, 'Graduate Visa', 'CAS9876543210', 'SPNSR123456', '2024-02-01 00:00:00', '2026-02-01 00:00:00', 'Graduate visa holder. No additional sponsorship required.', 1);

-- Insert Sample Data Consents
INSERT INTO DataConsent (employeeId, consentType, consentGiven, consentDate, ipAddress, version, createdAt, updatedAt) VALUES
(1, 'data_processing', 1, '2023-01-15 09:00:00', '192.168.1.100', '1.0', NOW(), NOW()),
(2, 'data_processing', 1, '2023-03-20 09:00:00', '192.168.1.101', '1.0', NOW(), NOW()),
(3, 'data_processing', 1, '2023-06-10 09:00:00', '192.168.1.102', '1.0', NOW(), NOW()),
(4, 'data_processing', 1, '2022-09-01 09:00:00', '192.168.1.103', '1.0', NOW(), NOW()),
(5, 'data_processing', 1, '2021-04-01 09:00:00', '192.168.1.104', '1.0', NOW(), NOW()),
(6, 'data_processing', 1, '2024-02-01 09:00:00', '192.168.1.105', '1.0', NOW(), NOW());

-- Sample documents will be added via the UI since they require actual file uploads

SELECT 'Sample data inserted successfully!' as Status;
SELECT CONCAT('Employees: ', COUNT(*)) as Count FROM Employee;
SELECT CONCAT('Projects: ', COUNT(*)) as Count FROM Project;
SELECT CONCAT('Timesheets: ', COUNT(*)) as Count FROM Timesheet;
SELECT CONCAT('Leave Requests: ', COUNT(*)) as Count FROM LeaveRequest;
SELECT CONCAT('Sponsorships: ', COUNT(*)) as Count FROM Sponsorship;
