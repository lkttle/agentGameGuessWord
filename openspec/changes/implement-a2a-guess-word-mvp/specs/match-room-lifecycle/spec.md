## ADDED Requirements

### Requirement: Room creation and join
The system SHALL allow an authenticated user to create a match room and allow eligible participants to join by room identifier.

#### Scenario: Host creates a room
- **WHEN** an authenticated user submits a create-room request with a valid mode
- **THEN** the system creates a room in WAITING status and returns a joinable room identifier

#### Scenario: Player joins a room
- **WHEN** a participant provides a valid room identifier before match start
- **THEN** the system adds the participant to the room roster and returns the updated room state

### Requirement: Room lifecycle transitions
The system MUST enforce deterministic room status transitions from WAITING to RUNNING to FINISHED.

#### Scenario: Host starts a ready room
- **WHEN** start-match is requested on a room that satisfies participant and mode prerequisites
- **THEN** the system transitions the room to RUNNING and initializes a match record

#### Scenario: Match completes
- **WHEN** end conditions are satisfied by score, rounds, or timeout
- **THEN** the system transitions the room to FINISHED and stores final match results

### Requirement: Room access control
The system MUST prevent unauthorized users from mutating room state.

#### Scenario: Unauthorized room mutation attempt
- **WHEN** a user without required permission attempts to start or terminate a room
- **THEN** the system denies the operation and persists no room-state mutation

