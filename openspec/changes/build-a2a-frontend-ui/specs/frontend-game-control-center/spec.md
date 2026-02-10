## ADDED Requirements

### Requirement: Unified control center for core game lifecycle
The frontend MUST provide a unified control center that drives authenticated session, room lifecycle, round execution, and match finalization through existing backend APIs.

#### Scenario: Operator executes full lifecycle from one page
- **WHEN** a user accesses the home page and triggers lifecycle actions in order
- **THEN** the UI sends requests to existing endpoints and reflects returned room/match state without requiring manual API tooling

### Requirement: Source-of-truth API payload visibility
The frontend SHALL present latest API payload snapshots for key lifecycle domains to support demo verification.

#### Scenario: User inspects room and match payload
- **WHEN** an action completes or state is manually refreshed
- **THEN** the UI shows current JSON payloads for session, room state, match result, leaderboard, and metrics in readable form

### Requirement: Guarded action input validation
The frontend MUST validate required identifiers before firing dependent actions and surface actionable errors.

#### Scenario: Missing identifier for dependent action
- **WHEN** a user triggers room or match action without required `roomId` or `matchId`
- **THEN** the UI blocks request submission and displays a clear error message while preserving existing state
