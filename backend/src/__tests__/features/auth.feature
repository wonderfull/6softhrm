Feature: Authentication and password recovery
  As the HRM platform
  I want authentication flows to enforce current security rules
  So that only valid users gain access and password recovery works

  Scenario: Unauthenticated user listing is rejected
    When an unauthenticated client requests the user list
    Then the request is rejected with a 401 response

  Scenario: Public registration cannot self-assign admin role
    Given a public registration payload requesting the ADMIN role
    When the registration is submitted
    Then the created account is stored with the USER role

  Scenario: Valid login returns a JWT and user identity
    Given an existing registered user with a known password
    When the user logs in with valid credentials
    Then the login response contains a JWT token
    And the login response contains the user's email

  Scenario: Invalid password is rejected
    Given an existing registered user with a known password
    When the user logs in with an invalid password
    Then the request is rejected with a 401 response

  Scenario: Password reset token can be generated and redeemed
    Given an existing registered user with a known password
    When the user requests a password reset token
    And the user resets the password with the generated token
    Then the user can log in with the new password

  Scenario: Admin can generate a reset link for an employee
    Given an existing registered user with a known password
    When an admin generates a password reset link for that user
    Then the response contains a reset link for that user

  Scenario: Admin can set a temporary password for an employee
    Given an existing registered user with a known password
    When an admin directly resets that user's password
    Then the user can log in with the temporary password

  Scenario: Invalid reset token is rejected
    When a password reset is attempted with an invalid token
    Then the request is rejected with a 400 response
