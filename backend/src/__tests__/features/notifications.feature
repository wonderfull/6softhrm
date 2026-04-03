Feature: Expiry notifications
  As the HRM platform
  I want notification endpoints to respect role rules and expiry filtering
  So that expiry reporting remains correct

  Scenario: Manager can trigger expiry checks
    When a manager triggers an expiry check
    Then the expiry check succeeds

  Scenario: User cannot trigger expiry checks
    When a regular user triggers an expiry check
    Then the request is rejected with a 403 response

  Scenario: Upcoming expiries respects the days parameter
    Given upcoming expiry records within and outside the requested window
    When an admin requests upcoming expiries for 30 days
    Then only records within 30 days are returned
