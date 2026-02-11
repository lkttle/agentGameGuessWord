## ADDED Requirements

### Requirement: Question generation API SHALL return structured pinyin-initial questions
The system MUST provide a server API that returns question items containing per-character pinyin initials, the correct Chinese answer, and a category hint.

#### Scenario: Generate one default question
- **WHEN** a client requests question generation with default parameters
- **THEN** the API returns at least one question item containing `initials`, `initialsText`, `answer`, and `category`

### Requirement: Generated answers MUST be 2-4 Chinese characters
The system SHALL only return answers whose length is 2, 3, or 4 Chinese characters.

#### Scenario: Candidate exceeds allowed length
- **WHEN** a candidate question has an answer shorter than 2 characters or longer than 4 characters
- **THEN** the system excludes the candidate from the response set

### Requirement: Pinyin initials MUST map one-to-one with answer characters
The system MUST ensure each answer character has exactly one corresponding pinyin initial and MUST reject invalid mappings.

#### Scenario: Initial count mismatch
- **WHEN** a candidate answer length and initials length are not equal
- **THEN** the system rejects the candidate and does not include it in output

### Requirement: Initial format MUST be normalized for deterministic use
The system SHALL normalize each pinyin initial as a single uppercase Latin letter and SHALL derive `initialsText` by ordered concatenation.

#### Scenario: Valid question emitted
- **WHEN** a question passes validation
- **THEN** each `initials` element is one uppercase letter and `initialsText` equals the ordered join of `initials`

### Requirement: API SHALL support optional filtering by length and category
The system MUST allow callers to filter generated questions by requested word length and/or category.

#### Scenario: Request with length and category filters
- **WHEN** a client requests `length=3` and `category=水果`
- **THEN** every returned question has a 3-character answer and category value equal to `水果`

### Requirement: API MUST provide explicit error for empty result set
The system MUST return a validation-style error when no questions satisfy the requested constraints.

#### Scenario: No candidates match filters
- **WHEN** filtering constraints produce zero valid questions
- **THEN** the API responds with an error indicating no eligible questions can be generated

