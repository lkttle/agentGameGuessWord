## ADDED Requirements

### Requirement: Question generation SHOULD suppress near-term repeats when alternatives exist
The system MUST reduce immediate question repetition by avoiding recently served question keys whenever enough alternative candidates are available.

#### Scenario: Single question request with sufficient alternatives
- **WHEN** the API is asked to generate one question and there are candidates outside the recent-history window
- **THEN** the response chooses a candidate outside that window instead of repeating a very recent question

#### Scenario: Filtered request has too few candidates
- **WHEN** current filters produce only questions that are all in recent-history window
- **THEN** the API still returns a valid random question instead of failing
