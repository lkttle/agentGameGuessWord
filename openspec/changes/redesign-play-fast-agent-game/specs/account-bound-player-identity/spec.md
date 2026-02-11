## ADDED Requirements

### Requirement: Default identity derived from authenticated account
The system SHALL derive a player's default display identity from the authenticated account profile.

#### Scenario: User enters room without manual naming
- **WHEN** an authenticated user joins from the quick-start flow
- **THEN** the system assigns the room-facing player identity from account profile fields without requiring a display-name input step

### Requirement: Stable identity across play flow
The system MUST keep the same account-bound player identity across play entry, room state, match events, and result view.

#### Scenario: Match progresses across multiple rounds
- **WHEN** the room transitions from waiting to running and finally finished
- **THEN** the player's identity label remains consistent across all surfaced states

### Requirement: Optional alias cannot block start
The system SHALL treat user-edited alias as optional metadata and MUST NOT block match start if alias is absent.

#### Scenario: User keeps default profile identity
- **WHEN** the user does not provide an alias override
- **THEN** the system proceeds using account-derived identity and permits normal room start
