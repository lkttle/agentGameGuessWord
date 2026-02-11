# Design: Refactor Homepage & Play Page with Chat-Room Style UI

## Context

The current game flow requires users to navigate from homepage → play page → room page, creating unnecessary friction. The game room UI uses a traditional sidebar layout that doesn't feel engaging for a competitive game. This change simplifies the flow and creates an immersive chat-room style experience.

## Goals

1. Merge homepage and play functionality into a single page with inline game creation
2. Redesign game room as voice-chat-room style with circular avatar layout
3. Simplify to exactly 2 game modes with 2-5 player support
4. Implement new per-round scoring (+1 correct) and ranked leaderboard bonuses
5. Display pinyin initials as hints (not Chinese characters) via question API
6. Remove dead code and unused components

## Non-Goals

- No WebSocket/real-time push changes
- No changes to authentication flow
- No database schema changes
- No changes to agent orchestrator logic

## Key Decisions

1. **Homepage as game entry**: The homepage will contain mode selection and directly trigger room creation + game start. The `/play` page route will be removed.

2. **Voice-chat-room layout**: Players displayed in a grid/circle layout with large avatars, scores below each avatar. Chat-like round log scrolls in the center. Input at the bottom.

3. **Participant count 2-5**: Update `MAX_PARTICIPANTS` from 4 to 5. Default 4 players. System auto-adjusts if fewer available.

4. **Scoring change**: Replace complex scoring (10 + bonus) with simple +1 per correct answer. Leaderboard bonuses awarded at game end based on final ranking and player count.

5. **Question API integration**: Each round fetches a question from `/api/questions/generate`, uses `initialsText` as the hint display instead of showing Chinese characters.

6. **Files to remove**: `/src/app/play/page.tsx`, `/src/components/GameControlCenter.tsx`, `/src/components/RoomStatePollingPanel.tsx`, `/src/hooks/use-room-state-polling.ts`.
