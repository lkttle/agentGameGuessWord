## ADDED Requirements

### Requirement: Logged-in users can field their own agent
The system SHALL allow an authenticated user to include their own account-linked agent as a participant in supported match modes.

#### Scenario: User enables self agent participation
- **WHEN** a user selects a mode that supports self-agent and starts a match
- **THEN** the room roster includes an agent participant linked to that user account

### Requirement: Self agent participation replaces spectator-first flow
The system MUST prioritize direct participation and MUST NOT require a spectator-only route as the primary way to enter A2A gameplay.

#### Scenario: User opens play with valid account
- **WHEN** a user reaches the main play entry
- **THEN** the default primary actions promote joining a match with player and/or self agent instead of spectator-only entry

### Requirement: Graceful fallback when self agent unavailable
The system SHALL provide a fallback participant option when self-agent initialization fails.

#### Scenario: Self agent cannot be initialized
- **WHEN** self-agent setup fails due to account capability or transient platform error
- **THEN** the system offers a supported fallback (such as platform agent) and preserves user ability to start a match
