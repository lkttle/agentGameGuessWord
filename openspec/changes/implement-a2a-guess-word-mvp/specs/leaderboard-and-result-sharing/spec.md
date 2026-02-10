## ADDED Requirements

### Requirement: Match-result leaderboard updates
The system SHALL update leaderboard standings when a match is finalized.

#### Scenario: Match finalization updates leaderboard
- **WHEN** a match transitions to FINISHED with final scores
- **THEN** the system records score contributions and updates configured leaderboard views (daily and/or all-time)

### Requirement: Leaderboard query endpoint
The system MUST provide a read API for leaderboard entries sorted by ranking policy.

#### Scenario: Client requests leaderboard
- **WHEN** a client requests leaderboard data for a supported period
- **THEN** the system returns ranked entries with stable tie-break behavior

### Requirement: Shareable result artifact
The system SHALL generate a shareable result artifact for each completed match.

#### Scenario: User opens match result page
- **WHEN** a completed match result is requested
- **THEN** the system returns a share-ready summary containing participants, outcome, and key match stats

