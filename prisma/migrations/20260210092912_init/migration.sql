-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('AGENT_VS_AGENT', 'HUMAN_VS_AGENT');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "MetricEventType" AS ENUM ('LOGIN_SUCCESS', 'MATCH_START', 'MATCH_COMPLETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "secondme_user_id" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "route" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "host_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT,
    "participant_type" "ParticipantType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "seat_order" INTEGER NOT NULL,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'RUNNING',
    "winner_user_id" TEXT,
    "total_rounds" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_logs" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "round_index" INTEGER NOT NULL,
    "actor_type" "ParticipantType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "guess_word" TEXT,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "score_delta" INTEGER NOT NULL DEFAULT 0,
    "timed_out" BOOLEAN NOT NULL DEFAULT false,
    "elapsed_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "date_key" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_events" (
    "id" TEXT NOT NULL,
    "event_type" "MetricEventType" NOT NULL,
    "user_id" TEXT,
    "room_id" TEXT,
    "match_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_secondme_user_id_key" ON "users"("secondme_user_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "rooms_host_user_id_idx" ON "rooms"("host_user_id");

-- CreateIndex
CREATE INDEX "participants_room_id_idx" ON "participants"("room_id");

-- CreateIndex
CREATE INDEX "participants_user_id_idx" ON "participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_room_id_seat_order_key" ON "participants"("room_id", "seat_order");

-- CreateIndex
CREATE UNIQUE INDEX "matches_room_id_key" ON "matches"("room_id");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_winner_user_id_idx" ON "matches"("winner_user_id");

-- CreateIndex
CREATE INDEX "round_logs_match_id_round_index_idx" ON "round_logs"("match_id", "round_index");

-- CreateIndex
CREATE INDEX "round_logs_actor_id_idx" ON "round_logs"("actor_id");

-- CreateIndex
CREATE INDEX "leaderboard_entries_period_score_idx" ON "leaderboard_entries"("period", "score");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_user_id_period_date_key_key" ON "leaderboard_entries"("user_id", "period", "date_key");

-- CreateIndex
CREATE INDEX "metric_events_event_type_created_at_idx" ON "metric_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "metric_events_user_id_idx" ON "metric_events"("user_id");

-- CreateIndex
CREATE INDEX "metric_events_room_id_idx" ON "metric_events"("room_id");

-- CreateIndex
CREATE INDEX "metric_events_match_id_idx" ON "metric_events"("match_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_user_id_fkey" FOREIGN KEY ("winner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_logs" ADD CONSTRAINT "round_logs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
