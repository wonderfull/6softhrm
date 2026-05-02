Feature: Sponsorship compliance evidence
  As a sponsor licence holder
  I want sponsorship compliance evidence tracked against sponsored workers
  So that right-to-work and Appendix D records are complete and auditable

  Scenario Outline: HR support roles can view a compliance pack
    Given a sponsored employee has no compliance evidence
    When a <role> views the sponsorship compliance pack
    Then the compliance pack is returned with five missing evidence rows

    Examples:
      | role             |
      | ADMIN            |
      | DIRECTOR         |
      | OFFICE_ASSISTANT |

  Scenario: Employee cannot view another worker's compliance pack
    Given a sponsored employee has no compliance evidence
    And a different linked employee is signed in
    When the linked employee views the sponsorship compliance pack
    Then the compliance pack is not found

  Scenario: Office assistant can add compliance evidence but cannot edit core sponsorship
    Given a sponsored employee has a matching document
    When the office assistant adds right-to-work compliance evidence
    Then the evidence is recorded in the compliance pack
    And an audit log records the compliance evidence creation
    When the office assistant updates the sponsorship visa type
    Then the core sponsorship update is forbidden

  Scenario: Document evidence must belong to the sponsored employee
    Given a sponsored employee has no compliance evidence
    And another employee has a document
    When the office assistant adds compliance evidence using the other employee's document
    Then the evidence request is rejected

  Scenario: Compliance pack shows missing evidence until evidence exists
    Given a sponsored employee has a matching document
    When an admin views the sponsorship compliance pack
    Then right-to-work evidence is missing
    When the office assistant adds right-to-work compliance evidence
    And an admin views the sponsorship compliance pack
    Then right-to-work evidence is complete
