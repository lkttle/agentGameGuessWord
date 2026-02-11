## ADDED Requirements

### Requirement: Fast play entry without manual room id
The system SHALL let an authenticated user start a playable session from the `play` page without manually entering a room identifier.

#### Scenario: User starts from mode card
- **WHEN** an authenticated user selects a supported mode and taps quick start
- **THEN** the system creates or allocates a room and returns the target room context without requiring manual room-id input

### Requirement: Two-step start experience
The system MUST keep the default play-entry flow within two core actions: mode selection and start confirmation.

#### Scenario: User follows default quick flow
- **WHEN** a user opens `play` and uses default options
- **THEN** the system reaches a running or ready room state within two explicit user actions

### Requirement: Advanced configuration as optional path
The system SHALL expose advanced room controls as optional settings and MUST NOT block the default quick-start path.

#### Scenario: User skips advanced settings
- **WHEN** a user does not open advanced options
- **THEN** the system still starts a valid room with default configuration values
