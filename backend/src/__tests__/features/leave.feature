Feature: Leave request lifecycle
  As a HR team
  I want leave requests to respect linked-user access and approval flows
  So that self-service and manager actions remain safe

  Scenario: Linked user submits a leave request
    Given a linked employee user
    When the linked user submits a leave request
    Then the leave request is created with PENDING status

  Scenario: Unlinked user cannot submit leave
    Given an unlinked employee user
    When the unlinked user submits a leave request
    Then the leave submission is rejected with a 403 response

  Scenario: Admin can list all leave requests
    Given multiple leave requests exist for different employees
    When an admin requests the leave list
    Then the admin receives all matching leave requests

  Scenario: Manager approves a pending request
    Given a pending leave request
    When a manager approves the request
    Then the leave request status becomes APPROVED

  Scenario: Manager rejects a pending request
    Given a pending leave request
    When a manager rejects the request
    Then the leave request status becomes REJECTED
