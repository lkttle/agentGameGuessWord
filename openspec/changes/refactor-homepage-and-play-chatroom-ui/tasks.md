# Tasks: Refactor Homepage & Play Page with Chat-Room Style UI

## 1. Domain & Backend Updates

### 1.1 Update participant limit to 5
- [x] Update `MAX_PARTICIPANTS` in `participants.ts` from 4 to 5
- [x] Update participant count select options to include 5

### 1.2 Update scoring system
- [x] Modify `evaluateRound` in `guess-word-engine.ts`: correct = +1, wrong = 0
- [x] Add leaderboard bonus calculation at match finish

### 1.3 Update room start validation
- [x] Allow 2-5 participants in room start validation

## 2. Homepage Refactor

### 2.1 Merge play functionality into homepage
- [x] Rewrite `page.tsx` as client component with game mode selection + inline start
- [x] Two modes only: "Player VS Agent" and "Player's Agent VS Other Agents"
- [x] Player count selector (2-5, default 4)
- [x] Clicking start immediately creates room, starts match, and navigates to game room

## 3. Game Room Chat-Room Style UI

### 3.1 Redesign room page
- [x] Voice-chat-room style layout with circular avatar grid
- [x] Scores below each avatar
- [x] Pinyin initials hint display (from question API)
- [x] Chat-style round log
- [x] Bottom text input for guessing

### 3.2 Question API integration
- [x] Fetch question from `/api/questions/generate` each round
- [x] Display `initialsText` as hint (not Chinese characters)

## 4. CSS Updates

### 4.1 Add chat-room game styles
- [x] Avatar circle grid layout
- [x] Chat message bubbles for round log
- [x] Bottom input bar styling
- [x] Responsive breakpoints

## 5. Cleanup

### 5.1 Remove dead code
- [x] Delete `/src/app/play/page.tsx`
- [x] Delete `/src/components/GameControlCenter.tsx`
- [x] Delete `/src/components/RoomStatePollingPanel.tsx`
- [x] Delete `/src/hooks/use-room-state-polling.ts`
- [x] Remove play link from Navbar
