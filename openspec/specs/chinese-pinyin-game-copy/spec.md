## ADDED Requirements

### Requirement: Gameplay copy SHALL describe Chinese pinyin-initial guessing
The system MUST present the core gameplay as guessing common Chinese words by pinyin initials, and MUST NOT describe the game as English word guessing.

#### Scenario: User opens quick-play page
- **WHEN** a user views the primary guidance text on `/play`
- **THEN** the page explains the rule as guessing Chinese words from pinyin initials

### Requirement: Example hints SHALL align with Chinese word gameplay
The system SHALL provide at least one example showing that the same initials can map to multiple Chinese words.

#### Scenario: User reads rule example
- **WHEN** the user checks gameplay examples in entry or room context
- **THEN** the UI includes an example such as `CF` mapping to words like “吃饭 / 充分 / 出发”

### Requirement: Guess input copy MUST use Chinese-word semantics
The system MUST use Chinese-word-specific labels, placeholders, and validation messages for guess actions.

#### Scenario: User submits empty guess
- **WHEN** a user submits a guess without input
- **THEN** the system returns an error message that asks for a Chinese word guess instead of an English-word prompt

