## 1. OpenSpec Artifacts

- [x] 1.1 Draft proposal for full-question prewarm cache
- [x] 1.2 Draft technical design for cache/prewarm strategy
- [x] 1.3 Add spec delta for new cache capability
- [x] 1.4 Add spec delta for question repeat suppression

## 2. Data Model & Service Layer

- [x] 2.1 Add Prisma model for user-question cache with unique constraints
- [x] 2.2 Implement cache service for read/write/prewarm orchestration
- [x] 2.3 Add lightweight concurrency guard for prewarm execution

## 3. Runtime Integration

- [x] 3.1 Trigger global prewarm on authenticated home entry
- [x] 3.2 Trigger user prewarm on OAuth callback success
- [x] 3.3 Integrate cache-first agent answer flow in gameplay APIs
- [x] 3.4 Add prewarm trigger API endpoint for manual/background execution

## 4. Question Randomization

- [x] 4.1 Add near-term repeat suppression window in question generator
- [x] 4.2 Keep fallback random behavior when candidate pool is small

## 5. Validation & Delivery

- [x] 5.1 Run prisma generate and typecheck/build validation
- [x] 5.2 Mark completed tasks and summarize behavior changes
- [x] 5.3 Commit and push changes to remote
