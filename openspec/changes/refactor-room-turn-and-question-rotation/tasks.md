## 1. OpenSpec artifacts

- [x] 1.1 Create proposal for room turn/question refactor
- [x] 1.2 Create design with API and UI decisions
- [x] 1.3 Add spec for fixed rotation, timeout, and question sync

## 2. Backend single-turn protocol

- [x] 2.1 Refactor `human-move` to remove auto-agent batch logic
- [x] 2.2 Add `timedOut` move support and timeout round-log persistence
- [x] 2.3 Validate request question context via `questionKey` parsing
- [x] 2.4 Refactor `agent-round` to require single `participantId` per call

## 3. Room page runtime consistency

- [x] 3.1 Keep participant cards fixed by seat order while preserving score/rank display
- [x] 3.2 On human timeout, submit timed-out move to backend before rotating turn
- [x] 3.3 Reveal answer when a full cycle has no correct guess, then switch question
- [x] 3.4 Keep question/turn switch behavior consistent after immediate correct answers

## 4. Validation and handoff

- [x] 4.1 Run typecheck for changed modules
- [x] 4.2 Mark completed tasks and summarize migration impact
