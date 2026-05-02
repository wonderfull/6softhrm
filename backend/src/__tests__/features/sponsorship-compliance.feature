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

  Scenario: Delayed sponsored worker start becomes reportable
    Given a sponsored worker was expected to start 29 days ago
    And the worker has not started
    When an admin reviews reportable sponsorship events
    Then the worker is flagged for delayed start reporting
    And the reporting deadline is 10 working days after the 28 day period

  Scenario: Ten consecutive unauthorised absence days becomes reportable
    Given a sponsored worker has 10 consecutive unauthorised absence days
    When a director reviews reportable sponsorship events
    Then the worker is flagged for unauthorised absence reporting

  Scenario: Office assistant can create report-support open events but cannot mark reported
    Given a sponsored employee has no compliance evidence
    When the office assistant creates a work location changed reportable event
    Then the reportable event is open
    When the office assistant marks the reportable event as reported
    Then the reportable event update is forbidden

  Scenario: Admin and director can mark reportable events as reported
    Given a sponsored employee has an open employment ended reportable event
    When a director marks the reportable event as reported
    Then the reportable event is marked as reported by the director
