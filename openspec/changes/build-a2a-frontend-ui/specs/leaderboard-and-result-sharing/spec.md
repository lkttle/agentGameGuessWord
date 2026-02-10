## MODIFIED Requirements

### Requirement: Shareable result artifact
The system SHALL generate a shareable result artifact for each completed match and the frontend MUST render it in a user-friendly report layout.

#### Scenario: User opens match result page
- **WHEN** a completed match result is requested
- **THEN** the system returns a share-ready summary containing participants, outcome, and key match stats
- **AND** the frontend presents these fields in a structured report view with clear labels and quick-share navigation affordances
