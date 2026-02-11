# Spec: Homepage Inline Game Start

## Requirements

- Homepage SHALL provide two game mode cards: "Player VS Agent" and "Player's Agent VS Other Agents"
- Clicking a mode card SHALL immediately begin the game creation flow without navigating to another page
- Player count selector SHALL support 2-5 players (default 4)
- System SHALL auto-fill remaining slots with platform agents
- If insufficient players are available, system SHALL reduce to minimum viable count (2)
- The `/play` route SHALL be removed; all game-start functionality lives on homepage
