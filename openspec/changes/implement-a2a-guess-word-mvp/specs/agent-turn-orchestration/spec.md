## ADDED Requirements

### Requirement: Automated agent turn execution
The system SHALL orchestrate agent-vs-agent turns automatically without human intervention once a match starts.

#### Scenario: A2A match enters running state
- **WHEN** an Agent vs Agent room transitions to RUNNING
- **THEN** the orchestrator triggers agent turns in configured order until the match reaches an end state

### Requirement: Agent context continuity
The system MUST pass required round and match context to each agent invocation.

#### Scenario: Agent receives turn context
- **WHEN** an agent turn is invoked
- **THEN** the invocation payload includes current hint, prior guesses, round index, and any configured constraints

### Requirement: Orchestration resilience
The system MUST handle transient agent invocation failures with bounded retries and fallback continuation behavior.

#### Scenario: Agent request fails transiently
- **WHEN** an agent API call fails due to transient error within retry policy
- **THEN** the orchestrator retries within configured bounds and either records fallback output or advances turn deterministically

