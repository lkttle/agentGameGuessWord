## ADDED Requirements

### Requirement: Structured match result presentation
The frontend MUST render match-result data as a structured report with high-signal metadata and participant performance.

#### Scenario: User opens valid result page
- **WHEN** `/results/:matchId` resolves a valid result payload
- **THEN** the UI displays match metadata, winner context, and participant performance table in a share-friendly layout

### Requirement: Graceful fallback for missing result
The frontend SHALL provide a clear not-found state for unavailable match reports.

#### Scenario: Invalid match identifier
- **WHEN** result API returns non-success response for requested `matchId`
- **THEN** the page renders an explicit missing-report message and guidance instead of broken content

### Requirement: Result page quick actions
The frontend MUST include quick actions for navigation and raw data verification.

#### Scenario: User needs follow-up action from report
- **WHEN** a user reaches the result page
- **THEN** the UI provides links back to control center and to result JSON endpoint for cross-checking
