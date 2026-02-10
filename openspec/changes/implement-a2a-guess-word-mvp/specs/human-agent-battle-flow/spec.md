## ADDED Requirements

### Requirement: Human move submission
The system SHALL allow an authenticated human player to submit guesses during their legal turn window.

#### Scenario: Human submits valid guess
- **WHEN** the player submits a valid guess while it is the human turn and the match is RUNNING
- **THEN** the system accepts the move, evaluates it via the game engine, and returns updated round state

### Requirement: Input validation and guardrails
The system MUST validate human input format and reject invalid or out-of-turn submissions.

#### Scenario: Invalid or out-of-turn input
- **WHEN** a guess violates format constraints or is submitted outside the player's legal turn
- **THEN** the system rejects the input with a validation error and preserves current match state

### Requirement: Agent response progression
The system SHALL automatically trigger agent response after a valid human move when the round remains unresolved.

#### Scenario: Round continues after human guess
- **WHEN** a valid human move does not end the round
- **THEN** the orchestrator invokes the agent for the next turn and publishes refreshed match state

