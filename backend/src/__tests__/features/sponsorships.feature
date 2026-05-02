Feature: Sponsorship access control
  As an HRM system owner
  I want sponsorship records protected by backend authorization
  So that sponsored worker details are not exposed to unauthorised users

  Scenario: Employee cannot list all sponsorships
    Given another employee has an active sponsorship
    And a linked employee is signed in
    When the linked employee lists sponsorships
    Then no other employee sponsorships are returned

  Scenario: Unlinked employee cannot view expiring sponsorships
    Given another employee has a sponsorship expiring soon
    And an unlinked employee user is signed in
    When the unlinked employee views expiring sponsorships
    Then no expiring sponsorships are returned

  Scenario: Director can manage sponsorships
    Given a director is signed in
    And an employee exists
    When the director creates a sponsorship for that employee
    Then the sponsorship is created
    And an audit log records the sponsorship creation

  Scenario: Office assistant cannot edit sponsorship core details
    Given an office assistant is signed in
    And an employee has an active sponsorship
    When the office assistant updates the sponsorship visa type
    Then the request is forbidden
