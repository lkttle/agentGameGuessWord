## ADDED Requirements

### Requirement: Explicit battle mode choices on play entry
The system SHALL present supported battle modes at play entry, including player-vs-platform-agent and player-vs-self-agent.

#### Scenario: User opens mode selector
- **WHEN** an authenticated user loads the play entry
- **THEN** the interface lists supported battle modes with enough metadata for the user to choose one

### Requirement: Mode selection drives room configuration
The system MUST map each selected mode to deterministic room and participant configuration.

#### Scenario: User chooses player-vs-self-agent
- **WHEN** the user confirms the player-vs-self-agent mode
- **THEN** the room is initialized with exactly one human participant and one self-agent participant bound to the same account owner

### Requirement: Unsupported mode combinations are rejected
The system MUST reject invalid or unsupported mode selections before match start.

#### Scenario: Client submits unsupported mode payload
- **WHEN** the create/start request includes a mode not supported by current server rules
- **THEN** the system returns a validation error and does not transition the room into running state
