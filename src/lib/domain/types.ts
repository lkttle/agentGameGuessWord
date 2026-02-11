export const GAME_MODES = {
  AGENT_VS_AGENT: 'AGENT_VS_AGENT',
  HUMAN_VS_AGENT: 'HUMAN_VS_AGENT'
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

export const ROOM_STATUSES = {
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  FINISHED: 'FINISHED'
} as const;

export type RoomStatus = (typeof ROOM_STATUSES)[keyof typeof ROOM_STATUSES];

export const MATCH_STATUSES = {
  RUNNING: 'RUNNING',
  FINISHED: 'FINISHED'
} as const;

export type MatchStatus = (typeof MATCH_STATUSES)[keyof typeof MATCH_STATUSES];

export const PARTICIPANT_TYPES = {
  HUMAN: 'HUMAN',
  AGENT: 'AGENT'
} as const;

export type ParticipantType = (typeof PARTICIPANT_TYPES)[keyof typeof PARTICIPANT_TYPES];

export const AGENT_SOURCES = {
  SELF: 'SELF',
  PLATFORM: 'PLATFORM'
} as const;

export type AgentSource = (typeof AGENT_SOURCES)[keyof typeof AGENT_SOURCES];

export const LEADERBOARD_PERIODS = {
  DAILY: 'DAILY',
  ALL_TIME: 'ALL_TIME'
} as const;

export type LeaderboardPeriod =
  (typeof LEADERBOARD_PERIODS)[keyof typeof LEADERBOARD_PERIODS];

export const METRIC_EVENT_TYPES = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  MATCH_START: 'MATCH_START',
  MATCH_COMPLETE: 'MATCH_COMPLETE'
} as const;

export type MetricEventType =
  (typeof METRIC_EVENT_TYPES)[keyof typeof METRIC_EVENT_TYPES];

export interface ScoreSummary {
  participantId: string;
  totalScore: number;
  roundsWon: number;
}
