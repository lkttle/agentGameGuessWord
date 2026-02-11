# Proposal: Refactor Homepage & Play Page with Chat-Room Style UI

## Why

Current homepage has unnecessary redirect to `/play` page before entering games. The game room UI uses a traditional panel layout that lacks engagement. Users need a streamlined experience that goes from homepage directly into gameplay with a voice-chat-room style interface.

## What Changes

1. **Homepage becomes the game entry point**: Remove the separate `/play` page. Homepage directly offers 2 game modes with inline game creation - clicking "start" immediately enters gameplay.

2. **Two game modes only**:
   - "Player VS Agent" (HUMAN_VS_AGENT): Player directly competes against AI agents
   - "Player's Agent VS Other Agents" (AGENT_VS_AGENT): Player's SecondMe agent competes on their behalf

3. **Player count 2-5**: Users can choose to play with 1-4 agents (total 2-5 players). Default is 4 players. System auto-fills with platform agents if needed, or reduces player count if not enough.

4. **Voice-chat-room style game UI**: Game room redesigned as a circular avatar layout (like a voice chat room), showing SecondMe avatars with scores underneath. Text input at bottom for guessing.

5. **New scoring system**:
   - Per round: correct = +1, wrong = 0
   - Final leaderboard bonus based on player count and ranking
   - 2 players: winner +1
   - 3 players: 1st +2, 2nd +1
   - 4 players: 1st +3, 2nd +2, 3rd +1
   - 5 players: 1st +3, 2nd +2, 3rd +1 (max +3)

6. **Pinyin initials hint**: Integrate `/api/questions/generate` API. Display pinyin initials (e.g., "CF") not Chinese characters as hints.

7. **Dead code cleanup**: Remove unused components and files from `/src`.
