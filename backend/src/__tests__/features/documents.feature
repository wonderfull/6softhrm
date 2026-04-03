Feature: Document lifecycle
  As the HRM platform
  I want document upload, expiry, download, and ownership checks covered
  So that document handling regressions are caught quickly

  Scenario: Valid document upload succeeds
    Given an existing employee record for document upload
    When an admin uploads a valid PDF document with an expiry date
    Then the document is stored with the provided type and expiry date

  Scenario: Expiring documents returns only documents within the next 30 days
    Given documents expiring soon and later than 30 days
    When an admin requests expiring documents
    Then only the soon-to-expire document is returned

  Scenario: Employee cannot delete another employee's document
    Given a document owned by a different employee
    When a linked employee tries to delete that document
    Then the delete request is rejected with a 403 response

  Scenario: Employee can delete their own document
    Given a document owned by the linked employee
    When the linked employee deletes that document
    Then the document delete succeeds

  Scenario: Download all returns a ZIP for an employee with documents
    Given an employee with a stored document file
    When an admin downloads all documents for that employee
    Then the response is a ZIP download
