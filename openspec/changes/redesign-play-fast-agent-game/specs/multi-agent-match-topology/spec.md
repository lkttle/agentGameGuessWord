## ADDED Requirements

### Requirement: Match supports more than two agent participants
The system SHALL support match topologies with multiple agent participants beyond fixed 1v1.

#### Scenario: Host configures multi-agent topology
- **WHEN** a room is created with a valid multi-agent participant configuration
- **THEN** the room state persists all configured participants and marks the topology as multi-agent

### Requirement: Turn orchestration rotates across active participants
The system MUST schedule turns across all active participants according to deterministic ordering rules.

#### Scenario: Three agents are active
- **WHEN** the match enters running state with three active participants
- **THEN** each round progression advances turn ownership in a stable, deterministic order across all three participants

### Requirement: Match completion and scoring for multi-agent outcomes
The system SHALL compute and persist match outcome for all participants in multi-agent topology.

#### Scenario: Multi-agent match reaches completion condition
- **WHEN** the configured completion rule is satisfied in a multi-agent room
- **THEN** the system finalizes the match and stores result records for each participant's rank/score outcome

### Requirement: Guardrails for multi-agent performance and validity
The system MUST enforce server-side limits for participant count and reject invalid topology payloads.

#### Scenario: Participant count exceeds maximum allowed
- **WHEN** a create/start request includes more participants than configured server maximum
- **THEN** the system rejects the request with validation error and does not start the match
