## ADDED Requirements

### Requirement: Cache prewarm orchestration MUST be backend-driven
The system MUST trigger and coordinate agent cache prewarm from backend flows rather than frontend page-side triggers.

#### Scenario: Authenticated session access
- **WHEN** an authenticated user session is resolved by backend API
- **THEN** backend starts non-blocking cache prewarm orchestration without requiring frontend explicit prewarm call

### Requirement: Gameplay responses MUST remain cache-first with write-back fallback
Backend response generation MUST return cached answer/voice first and, when missing, perform real-time generation and persist cache.

#### Scenario: Cache miss in gameplay flow
- **WHEN** backend cannot find READY cache for user-question
- **THEN** backend fetches real-time answer and voice, returns result, and writes back cache record

### Requirement: Prewarm execution MUST support concurrency and retries safely
Prewarm workers MUST process pending user-question pairs concurrently with bounded retries while preventing duplicate cache rows for the same pair.

#### Scenario: Parallel pair processing with failure retry
- **WHEN** multiple uncached pairs are queued and one pair fails transiently
- **THEN** system retries failed pair within configured limit and keeps other worker tasks progressing concurrently

#### Scenario: Duplicate pair is attempted concurrently
- **WHEN** two workers or requests target the same user-question pair
- **THEN** system enforces de-duplication via lock/unique key and stores only one effective cache result
