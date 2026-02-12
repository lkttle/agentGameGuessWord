## 1. OpenSpec Artifacts

- [x] 1.1 Draft proposal for backend-only cache orchestration
- [x] 1.2 Draft design for concurrency/retry safety
- [x] 1.3 Add capability spec for backend cache orchestration

## 2. Frontend Trigger Migration

- [x] 2.1 Remove homepage prewarm trigger from frontend
- [x] 2.2 Keep frontend behavior as pure backend API consumer

## 3. Backend Orchestrator Upgrade

- [x] 3.1 Add backend auto-trigger entry for authenticated sessions
- [x] 3.2 Upgrade prewarm to concurrent worker pool
- [x] 3.3 Add bounded retry per user-question pair
- [x] 3.4 Preserve anti-duplicate guarantees under concurrency

## 4. Validation & Delivery

- [x] 4.1 Run prisma generate, typecheck, build
- [x] 4.2 Update tasks completion states
- [x] 4.3 Commit and push to remote
