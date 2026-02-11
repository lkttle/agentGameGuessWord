# Spec: Scoring and Leaderboard

## Requirements

- Per-round scoring: correct answer = +1 point, incorrect = 0 points (no deduction)
- Final leaderboard bonus based on player count and ranking:
  - 2 players: winner +1
  - 3 players: 1st +2, 2nd +1
  - 4 players: 1st +3, 2nd +2, 3rd +1
  - 5 players: 1st +3, 2nd +2, 3rd +1
  - Maximum bonus is +3 regardless of player count
  - Only top 3 players receive leaderboard bonus
- Leaderboard SHALL be updated at match finalization
