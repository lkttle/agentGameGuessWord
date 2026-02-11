-- CreateEnum
CREATE TYPE "WarmupCacheStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "agent_standby_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_standby_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_question_queue" (
    "id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "initials_text" TEXT NOT NULL,
    "initials_json" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warmup_question_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_warmup_cache" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "reply_text" TEXT NOT NULL,
    "status" "WarmupCacheStatus" NOT NULL DEFAULT 'PENDING',
    "tts_url" TEXT,
    "tts_format" TEXT,
    "tts_duration_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_warmup_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_questions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "initials_text" TEXT NOT NULL,
    "initials_json" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_locks" (
    "lock_key" TEXT NOT NULL,
    "owner_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warmup_locks_pkey" PRIMARY KEY ("lock_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_standby_queue_user_id_key" ON "agent_standby_queue"("user_id");

-- CreateIndex
CREATE INDEX "agent_standby_queue_created_at_idx" ON "agent_standby_queue"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "warmup_question_queue_question_key_key" ON "warmup_question_queue"("question_key");

-- CreateIndex
CREATE INDEX "warmup_question_queue_created_at_idx" ON "warmup_question_queue"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_warmup_cache_user_id_question_key_key" ON "agent_warmup_cache"("user_id", "question_key");

-- CreateIndex
CREATE INDEX "agent_warmup_cache_user_id_status_idx" ON "agent_warmup_cache"("user_id", "status");

-- CreateIndex
CREATE INDEX "agent_warmup_cache_question_key_idx" ON "agent_warmup_cache"("question_key");

-- CreateIndex
CREATE INDEX "agent_warmup_cache_user_id_reply_text_idx" ON "agent_warmup_cache"("user_id", "reply_text");

-- CreateIndex
CREATE UNIQUE INDEX "match_questions_match_id_question_key_key" ON "match_questions"("match_id", "question_key");

-- CreateIndex
CREATE INDEX "match_questions_match_id_consumed_at_created_at_idx" ON "match_questions"("match_id", "consumed_at", "created_at");

-- CreateIndex
CREATE INDEX "warmup_locks_expires_at_idx" ON "warmup_locks"("expires_at");

-- AddForeignKey
ALTER TABLE "agent_standby_queue" ADD CONSTRAINT "agent_standby_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_warmup_cache" ADD CONSTRAINT "agent_warmup_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_questions" ADD CONSTRAINT "match_questions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
