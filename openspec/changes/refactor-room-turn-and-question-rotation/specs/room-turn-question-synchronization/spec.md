## ADDED Requirements

### Requirement: Room turn order MUST rotate by fixed seat order
The system MUST rotate turn ownership in deterministic seat order and MUST NOT reorder participant cards by dynamic score changes.

#### Scenario: Four participants complete two cycles
- **GIVEN** participants A, B, C, D are seated in order 1..4
- **WHEN** the match is running
- **THEN** turns advance as A→B→C→D→A regardless of whether each answer is correct, wrong, or timed out
- **AND** participant avatar/card order remains fixed by seat order during gameplay

### Requirement: Each participant turn MUST enforce 20-second timeout with progression
The system MUST enforce a 20-second limit per turn and progress to the next participant immediately when timeout occurs.

#### Scenario: Human player times out
- **GIVEN** it is participant B's turn and B does not submit a valid answer in 20 seconds
- **WHEN** timeout is reached
- **THEN** the system records a timed-out round log for B with zero score delta
- **AND** the next turn starts for participant C

### Requirement: Submission MUST stay consistent with current question key
The system MUST validate that a move request matches the active question key context to avoid stale-question submissions.

#### Scenario: Stale question payload is submitted
- **GIVEN** client still holds old `questionKey`
- **WHEN** it submits move data that does not match the current key context
- **THEN** server rejects or skips the move as stale
- **AND** no conflicting answer is written under mismatched question context

### Requirement: Correct answer MUST immediately switch to a new question for next participant
When any participant answers correctly, the system MUST immediately switch to a new question and pass turn to the next seat.

#### Scenario: Mid-cycle participant answers correctly
- **GIVEN** current question key is `GZ|广州|地名` and it is participant B's turn
- **WHEN** B answers correctly
- **THEN** the question updates immediately to a new key
- **AND** participant C becomes the next turn owner on the new question

### Requirement: Full cycle without correct answer MUST reveal and rotate question
If all participants in a cycle answer without any correct result, the system MUST reveal the current answer and then rotate to a new question.

#### Scenario: No one solves within one full cycle
- **GIVEN** participants A→B→C→D each complete one turn on the same question and all are incorrect or timed out
- **WHEN** D's turn finishes
- **THEN** the system reveals that round's answer
- **AND** the next question is generated immediately
- **AND** turn ownership returns to A for the new question

### Requirement: Match MUST auto-finish when global game timer ends
The system MUST end the running match automatically when the room-level countdown reaches zero.

#### Scenario: Room timer reaches zero
- **GIVEN** a running match with remaining game time
- **WHEN** remaining time becomes 0
- **THEN** host flow automatically triggers room finish
- **AND** no new turns are accepted afterwards
