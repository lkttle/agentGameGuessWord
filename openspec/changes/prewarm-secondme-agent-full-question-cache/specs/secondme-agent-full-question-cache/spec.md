## ADDED Requirements

### Requirement: System MUST build unique full-question cache per eligible SecondMe user
The system MUST maintain cache records for every eligible SecondMe user (real logged-in account with valid token) against question-bank questions, with unique key semantics to avoid duplicate cache rows for the same user-question pair.

#### Scenario: Home entry triggers global cache fill
- **WHEN** an authenticated user enters the home page and prewarm is triggered
- **THEN** the backend starts a background cache-fill batch that prioritizes eligible SecondMe users and skips already-ready user-question cache pairs

### Requirement: System MUST trigger immediate cache fill for newly logged-in SecondMe user
After OAuth callback successfully upserts a user, the system MUST trigger prewarm for that user so newly joined agents are quickly trained on the question bank.

#### Scenario: New user completes OAuth callback
- **WHEN** OAuth callback persists tokens and profile for a SecondMe user
- **THEN** the system schedules a prewarm batch that includes this user without waiting for room gameplay traffic

### Requirement: Agent turns MUST be cache-first with real-time fallback
For agent answer generation during gameplay, the system MUST read cached text+voice first when question context is available; if cache is missing or invalid, it MUST call SecondMe SDK and write back cache.

#### Scenario: Cache hit during agent turn
- **WHEN** an agent turn request includes a resolvable question key and cache record exists for the participant owner
- **THEN** the system returns the cached agent text answer and avoids an extra live chat call for that turn

#### Scenario: Cache miss during agent turn
- **WHEN** no READY cache exists for the participant owner and question
- **THEN** the system calls SecondMe Chat/TTS, returns the live answer, and persists cache for subsequent turns

### Requirement: Cache payload MUST include both text answer and voice metadata
The cache entity MUST store agent text output and voice generation result (at minimum playable voice reference and metadata), enabling future playback without requiring repeated generation every turn.

#### Scenario: Persisting successful generation
- **WHEN** chat and TTS generation complete successfully for a user-question pair
- **THEN** the cache record stores text answer, voice payload/reference, and generation metadata with READY status
