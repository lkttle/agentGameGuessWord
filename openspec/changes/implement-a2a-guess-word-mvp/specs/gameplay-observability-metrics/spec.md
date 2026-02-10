## ADDED Requirements

### Requirement: Core gameplay metric events
The system MUST emit metric events for key funnel stages: login success, match start, and match completion.

#### Scenario: User login succeeds
- **WHEN** a user completes OAuth authentication successfully
- **THEN** the system emits a login-success metric event with timestamp and user identifier

#### Scenario: Match starts
- **WHEN** a room transitions from WAITING to RUNNING
- **THEN** the system emits a match-start metric event linked to room and mode metadata

#### Scenario: Match completes
- **WHEN** a running match reaches FINISHED status
- **THEN** the system emits a match-complete metric event including duration and completion reason

### Requirement: Metric query for submission reporting
The system SHALL provide aggregated metric views required for hackathon reporting.

#### Scenario: Admin requests funnel summary
- **WHEN** an authorized operator queries metric aggregates for a time window
- **THEN** the system returns at least login count, started-match count, and completion-rate calculation inputs

