Feature: GDPR self-service and admin visibility
  As the HRM platform
  I want personal-data access routes to enforce current permissions
  So that employees only access their own data and admins can audit activity

  Scenario: Admin can retrieve audit logs
    Given an existing audit log entry
    When an admin requests audit logs filtered by action
    Then the audit logs response includes the matching entry

  Scenario: Employee can request their own subject access data
    Given a linked employee user with personal records
    When the employee requests their own subject access data
    Then the export contains the employee email

  Scenario: Employee cannot request another employee's subject access data
    Given two different linked employee users
    When the first employee requests the second employee's subject access data
    Then the request is rejected with a 403 response

  Scenario: Employee can record consent and view consent history
    Given a linked employee user with no prior consent records
    When the employee records a consent choice
    And the employee requests their consent history
    Then the consent history contains the recorded consent type
