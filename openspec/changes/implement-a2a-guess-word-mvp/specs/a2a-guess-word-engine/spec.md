## ADDED Requirements

### Requirement: Initial-letter puzzle generation
The system SHALL generate a valid initial-letter puzzle per round using the configured dictionary and mask format.

#### Scenario: New round starts
- **WHEN** a new round is initialized for a running match
- **THEN** the system selects a target word and exposes only the allowed initial-letter hint format

### Requirement: Round-based answer evaluation
The system MUST evaluate guesses using deterministic matching rules and produce a round outcome.

#### Scenario: Correct guess
- **WHEN** a participant submits a guess that matches the target word under configured normalization rules
- **THEN** the system marks the round as solved and awards round score according to scoring policy

#### Scenario: Incorrect guess
- **WHEN** a participant submits a guess that does not match the target word
- **THEN** the system records the failed attempt and continues or advances the round per turn policy

### Requirement: Timeout fallback handling
The system MUST apply timeout fallback behavior when a participant does not act within the configured round deadline.

#### Scenario: Turn timeout
- **WHEN** a participant exceeds the turn timeout without valid input
- **THEN** the system applies the configured fallback outcome and advances match state without blocking

### Requirement: Match scoring and finalization
The system SHALL aggregate round outcomes into match-level scoring and final winner determination.

#### Scenario: Final round completed
- **WHEN** the last round ends or an early-win condition is reached
- **THEN** the system computes final scores, determines winner/draw, and emits a finalized match result

