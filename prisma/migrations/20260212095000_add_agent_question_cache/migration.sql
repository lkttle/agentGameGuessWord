-- CreateEnum
CREATE TYPE "AgentQuestionCacheStatus" AS ENUM ('READY', 'FAILED');

-- CreateTable
CREATE TABLE "agent_question_caches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "initials_text" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "answer_text" TEXT NOT NULL,
    "normalized_guess" TEXT,
    "audio_data_url" TEXT,
    "source_audio_url" TEXT,
    "tts_duration_ms" INTEGER,
    "tts_format" TEXT,
    "status" "AgentQuestionCacheStatus" NOT NULL DEFAULT 'READY',
    "last_error" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_question_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_question_caches_question_key_idx" ON "agent_question_caches"("question_key");

-- CreateIndex
CREATE INDEX "agent_question_caches_status_updated_at_idx" ON "agent_question_caches"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_question_caches_user_id_question_key_key" ON "agent_question_caches"("user_id", "question_key");

-- AddForeignKey
ALTER TABLE "agent_question_caches" ADD CONSTRAINT "agent_question_caches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
