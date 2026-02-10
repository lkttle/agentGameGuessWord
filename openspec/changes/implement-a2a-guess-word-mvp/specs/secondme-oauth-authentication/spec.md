## ADDED Requirements

### Requirement: SecondMe OAuth login flow
The system SHALL provide a complete SecondMe OAuth2 authorization-code login flow for web users.

#### Scenario: User completes OAuth login
- **WHEN** an unauthenticated user clicks login and successfully authorizes on SecondMe
- **THEN** the system exchanges the authorization code server-side and marks the user as authenticated

### Requirement: OAuth callback integrity protection
The system MUST validate callback integrity using state/nonce style verification before creating a session.

#### Scenario: Callback state is invalid
- **WHEN** the OAuth callback includes a missing or mismatched state value
- **THEN** the system rejects the callback and does not create or update a user session

### Requirement: Secure token handling
The system MUST keep access and refresh tokens on the server side and MUST NOT expose raw tokens to browser JavaScript.

#### Scenario: Frontend requests current session
- **WHEN** an authenticated frontend requests session status
- **THEN** the system returns non-sensitive user identity/session metadata without raw OAuth tokens
