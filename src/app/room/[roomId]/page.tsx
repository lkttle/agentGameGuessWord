'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_MODES,
  PARTICIPANT_TYPES,
  type GameMode,
  type ParticipantType
} from '@/lib/domain/types';

/* ----------------------------------------------------------------
   Types
   ---------------------------------------------------------------- */
interface Participant {
  id: string;
  userId: string | null;
  participantType: ParticipantType;
  displayName: string;
  seatOrder: number;
  ownerUserId?: string | null;
  agentSource?: 'SELF' | 'PLATFORM' | null;
  avatarUrl?: string | null;
  selfIntroduction?: string | null;
  status?: 'ACTIVE';
}

interface RoundLogEntry {
  id: string;
  roundIndex: number;
  actorId: string;
  guessWord: string;
  isCorrect: boolean;
  scoreDelta: number;
}

interface HumanMoveResponse {
  roundIndex: number;
  human: {
    participantId: string;
    guessWord: string;
    result: {
      isCorrect: boolean;
      scoreDelta: number;
      normalizedGuess: string;
      normalizedTarget: string;
      timedOut: boolean;
    };
  };
  agents: Array<{
    participantId: string;
    guessWord: string;
    usedFallback: boolean;
    result: {
      isCorrect: boolean;
      scoreDelta: number;
      normalizedGuess: string;
      normalizedTarget: string;
      timedOut: boolean;
    };
  }>;
}

interface RoomState {
  room: {
    id: string;
    mode: GameMode;
    status: string;
    hostUserId: string;
    participants: Participant[];
    match: {
      id: string;
      status: string;
      totalRounds: number;
      roundLogs?: RoundLogEntry[];
    } | null;
  };
}

interface SessionData {
  authenticated: boolean;
  user?: { id: string; name?: string | null };
}

interface PinyinQuestion {
  initials: string[];
  initialsText: string;
  answer: string;
  category: string;
}

/* ----------------------------------------------------------------
   API helper
   ---------------------------------------------------------------- */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store'
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data
      ? String((data as { error: unknown }).error) : `${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/* ----------------------------------------------------------------
   Time limit by player count
   ---------------------------------------------------------------- */
function getTimeLimitSeconds(playerCount: number): number {
  if (playerCount <= 2) return 180;
  if (playerCount <= 4) return 300;
  return 480;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------
   Avatar fallback gradients
   ---------------------------------------------------------------- */
const avatarGradients = [
  'linear-gradient(135deg, #7C3AED, #A855F7)',
  'linear-gradient(135deg, #EC4899, #F472B6)',
  'linear-gradient(135deg, #F59E0B, #F97316)',
  'linear-gradient(135deg, #0EA5E9, #38BDF8)',
  'linear-gradient(135deg, #14B8A6, #34D399)',
];

function getAvatarGradient(index: number): string {
  return avatarGradients[index % avatarGradients.length];
}

/* ----------------------------------------------------------------
   TTS Helper - auto-play agent responses
   ---------------------------------------------------------------- */
const ttsQueue: Array<() => Promise<boolean>> = [];
let ttsProcessing = false;
const MAX_TTS_ATTEMPTS = 3;
const AGENT_REPLY_GAP_MS = 2000;

function ttsClientDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('ttsDebug') === '1' || process.env.NEXT_PUBLIC_TTS_DEBUG === '1';
}

function ttsClientLog(event: string, payload?: Record<string, unknown>): void {
  if (!ttsClientDebugEnabled()) return;
  if (payload) {
    console.info(`[tts][client] ${event}`, payload);
    return;
  }
  console.info(`[tts][client] ${event}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function drainTtsQueue() {
  if (ttsProcessing) return;
  ttsProcessing = true;
  while (ttsQueue.length > 0) {
    const task = ttsQueue.shift();
    if (task) {
      try { await task(); } catch { /* ignore */ }
    }
  }
  ttsProcessing = false;
}

async function playTTS(
  text: string,
  options?: { userId?: string | null; participantId?: string }
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    ttsQueue.push(async () => {
      const startedAt = Date.now();
      let settled = false;
      const settle = (value: boolean): boolean => {
        if (!settled) {
          settled = true;
          ttsClientLog('queue_settle', {
            success: value,
            participantId: options?.participantId ?? null,
            userId: options?.userId ?? null,
            elapsedMs: Date.now() - startedAt
          });
          resolve(value);
        }
        return value;
      };

      try {
        ttsClientLog('request_start', {
          participantId: options?.participantId ?? null,
          userId: options?.userId ?? null,
          textLength: text.length,
          textPreview: text.slice(0, 40)
        });

        const body: Record<string, string> = { text, emotion: 'happy' };
        if (options?.userId) body.userId = options.userId;
        if (options?.participantId) body.participantId = options.participantId;

        const res = await fetch('/api/secondme/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store'
        });

        if (!res.ok) {
          let detail: unknown = null;
          try {
            detail = await res.json();
          } catch {
            detail = null;
          }
          ttsClientLog('request_http_failed', {
            status: res.status,
            statusText: res.statusText,
            detail
          });
          return settle(false);
        }

        const json = await res.json();
        const url = json?.data?.url;
        ttsClientLog('request_success', {
          requestId: json?.requestId ?? res.headers.get('x-tts-request-id') ?? null,
          hasUrl: Boolean(url),
          durationMs: json?.data?.durationMs ?? null
        });
        if (!url) {
          ttsClientLog('request_missing_url', { response: json });
          return settle(false);
        }

        const audio = new Audio(url);
        audio.volume = 0.7;
        ttsClientLog('audio_play_start', {
          url,
          participantId: options?.participantId ?? null
        });

        const played = await new Promise<boolean>((audioResolve) => {
          const fallbackTimer = setTimeout(() => audioResolve(false), 10000);
          audio.onended = () => {
            clearTimeout(fallbackTimer);
            ttsClientLog('audio_onended', {
              participantId: options?.participantId ?? null
            });
            audioResolve(true);
          };
          audio.onerror = () => {
            clearTimeout(fallbackTimer);
            ttsClientLog('audio_onerror', {
              participantId: options?.participantId ?? null,
              url
            });
            audioResolve(false);
          };
          audio.play().catch((error) => {
            clearTimeout(fallbackTimer);
            ttsClientLog('audio_play_rejected', {
              participantId: options?.participantId ?? null,
              error: error instanceof Error ? error.message : String(error)
            });
            audioResolve(false);
          });
        });

        return settle(played);
      } catch (error) {
        ttsClientLog('request_exception', {
          error: error instanceof Error ? error.message : String(error),
          participantId: options?.participantId ?? null
        });
        return settle(false);
      }
    });

    void drainTtsQueue();
  });
}

async function playTTSWithRetry(
  text: string,
  options?: { userId?: string | null; participantId?: string }
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt += 1) {
    ttsClientLog('retry_attempt', {
      attempt,
      maxAttempts: MAX_TTS_ATTEMPTS,
      participantId: options?.participantId ?? null
    });
    const success = await playTTS(text, options);
    if (success) return true;
    if (attempt < MAX_TTS_ATTEMPTS) {
      await sleep(400);
    }
  }
  return false;
}

/* ----------------------------------------------------------------
   Player Card Component - Social profile card with selfIntroduction
   ---------------------------------------------------------------- */
function PlayerCard({ participant, score, rank }: {
  participant: Participant;
  score: number;
  rank: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = participant.displayName.charAt(0).toUpperCase();
  const isHuman = participant.participantType === PARTICIPANT_TYPES.HUMAN;
  const label = isHuman ? '玩家' : (participant.agentSource === 'SELF' ? '我的Agent' : 'Agent');
  const hasAvatar = Boolean(participant.avatarUrl) && !imgFailed;

  return (
    <div className="player-card">
      {rank <= 3 && score > 0 && (
        <div className="player-card__rank">
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </div>
      )}
      <div
        className="player-card__avatar"
        style={hasAvatar ? undefined : { background: getAvatarGradient(participant.seatOrder - 1) }}
      >
        {hasAvatar ? (
          <img
            src={participant.avatarUrl!}
            alt={participant.displayName}
            className="player-card__avatar-img"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="player-card__avatar-initial">{initial}</span>
        )}
      </div>
      <div className="player-card__info">
        <div className="player-card__name">{participant.displayName}</div>
        <div className="player-card__badge-row">
          <span className={`player-card__badge ${isHuman ? 'player-card__badge--human' : 'player-card__badge--agent'}`}>
            {label}
          </span>
          <span className="player-card__score">{score} 分</span>
        </div>
        {participant.selfIntroduction && (
          <div className="player-card__intro">{participant.selfIntroduction}</div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Mini Avatar for chat bubbles
   ---------------------------------------------------------------- */
function MiniAvatar({ participant }: { participant: Participant }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = participant.displayName.charAt(0).toUpperCase();
  const hasAvatar = Boolean(participant.avatarUrl) && !imgFailed;

  return (
    <div
      className="chat-bubble__mini-avatar"
      style={hasAvatar ? undefined : { background: getAvatarGradient(participant.seatOrder - 1) }}
    >
      {hasAvatar ? (
        <img
          src={participant.avatarUrl!}
          alt=""
          className="chat-bubble__mini-avatar-img"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="chat-bubble__mini-avatar-text">{initial}</span>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Main Room Page
   ---------------------------------------------------------------- */
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guessWord, setGuessWord] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<PinyinQuestion | null>(null);
  const [failedRounds, setFailedRounds] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const autoFinishRef = useRef(false);
  const turnSkippingRef = useRef(false);
  const revealedAgentLogIdsRef = useRef(new Set<string>());
  const knownLogIdsRef = useRef(new Set<string>());
  const revealQueueRef = useRef<Array<{
    id: string;
    text: string;
    userId?: string | null;
    participantId?: string;
  }>>([]);
  const revealProcessingRef = useRef(false);
  const revealInitializedRef = useRef(false);
  const [revealedAgentLogIds, setRevealedAgentLogIds] = useState<string[]>([]);

  const revealAgentLog = useCallback((logId: string) => {
    if (revealedAgentLogIdsRef.current.has(logId)) return;
    revealedAgentLogIdsRef.current.add(logId);
    setRevealedAgentLogIds((prev) => (prev.includes(logId) ? prev : [...prev, logId]));
  }, []);

  const processRevealQueue = useCallback(async () => {
    if (revealProcessingRef.current) return;
    revealProcessingRef.current = true;
    ttsClientLog('reveal_queue_start', {
      queueLength: revealQueueRef.current.length
    });

    while (revealQueueRef.current.length > 0) {
      const next = revealQueueRef.current.shift();
      if (!next) continue;

      ttsClientLog('reveal_next', {
        logId: next.id,
        participantId: next.participantId ?? null,
        queueLeft: revealQueueRef.current.length
      });
      revealAgentLog(next.id);
      const played = await playTTSWithRetry(next.text, {
        userId: next.userId,
        participantId: next.participantId
      });
      ttsClientLog('reveal_tts_result', {
        logId: next.id,
        participantId: next.participantId ?? null,
        played
      });
      await sleep(AGENT_REPLY_GAP_MS);
    }

    revealProcessingRef.current = false;
    ttsClientLog('reveal_queue_end');
  }, [revealAgentLog]);

  // Compute scores from round logs
  const scores = new Map<string, number>();
  if (roomState?.room.match?.roundLogs) {
    for (const log of roomState.room.match.roundLogs) {
      scores.set(log.actorId, (scores.get(log.actorId) ?? 0) + log.scoreDelta);
    }
  }

  const room = roomState?.room;
  const match = room?.match;
  const isHost = session?.user?.id === room?.hostUserId;
  const participants = room?.participants ?? [];

  const humanParticipant = participants.find(p => p.participantType === PARTICIPANT_TYPES.HUMAN);
  const agentParticipants = participants.filter(p => p.participantType === PARTICIPANT_TYPES.AGENT);

  // Rank participants by score
  const rankedParticipants = [...participants].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
  );

  const fetchRoom = useCallback(async () => {
    try {
      const data = await api<RoomState>(`/api/rooms/${roomId}/state`);
      setRoomState(data);
    } catch {
      // Silently handle polling errors
    }
  }, [roomId]);

  // Fetch a new question from the API
  async function fetchQuestion() {
    try {
      const res = await api<{ questions: PinyinQuestion[] }>('/api/questions/generate', {
        method: 'POST',
        body: JSON.stringify({ count: 1 })
      });
      if (res.questions.length > 0) {
        setCurrentQuestion(res.questions[0]);
        setFailedRounds(0);
      }
    } catch {
      setCurrentQuestion({
        initials: ['C', 'F'],
        initialsText: 'CF',
        answer: '吃饭',
        category: '动作'
      });
      setFailedRounds(0);
    }
  }

  // Load session + initial room state
  useEffect(() => {
    async function init() {
      try {
        const s = await api<SessionData>('/api/auth/session');
        setSession(s);
      } catch { /* ignore */ }
      await fetchRoom();
    }
    void init();
  }, [fetchRoom]);

  // Fetch first question when match starts
  useEffect(() => {
    if (room?.status === 'RUNNING' && !currentQuestion) {
      void fetchQuestion();
    }
  }, [room?.status, currentQuestion]);

  // Start countdown timer when game begins
  useEffect(() => {
    if (room?.status === 'RUNNING' && !timerStarted && participants.length >= 2) {
      const limit = getTimeLimitSeconds(participants.length);
      setTimeLeft(limit);
      setTimerStarted(true);
    }
  }, [room?.status, timerStarted, participants.length]);

  // Countdown tick
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || room?.status !== 'RUNNING') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft !== null && timeLeft > 0, room?.status]);

  // Auto-finish when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && room?.status === 'RUNNING' && isHost && !autoFinishRef.current) {
      autoFinishRef.current = true;
      void handleFinish();
    }
  }, [timeLeft, room?.status, isHost]);

  // Per-turn 20s timer - start when match is running and no active action
  useEffect(() => {
    if (room?.status !== 'RUNNING' || !currentQuestion || isSubmitting || !!busy) {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      setTurnTimeLeft(null);
      return;
    }
    setTurnTimeLeft(20);
    turnSkippingRef.current = false;
    turnTimerRef.current = setInterval(() => {
      setTurnTimeLeft(prev => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    };
  }, [room?.status, currentQuestion, match?.roundLogs?.length, isSubmitting, busy]);

  // Auto-skip turn when per-turn timer reaches 0
  useEffect(() => {
    if (turnTimeLeft !== 0 || !currentQuestion || room?.status !== 'RUNNING' || turnSkippingRef.current || isSubmitting || !!busy) return;
    turnSkippingRef.current = true;
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    if (room.mode === GAME_MODES.AGENT_VS_AGENT) {
      void handleAgentRound();
    } else {
      // In HUMAN_VS_AGENT, auto-trigger agent round (skip human turn)
      void handleAgentRoundOnly();
    }
  }, [turnTimeLeft, room?.status, currentQuestion, isSubmitting, busy]);

  // Polling
  useEffect(() => {
    if (!roomId) return;
    pollingRef.current = setInterval(() => { void fetchRoom(); }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [roomId, fetchRoom]);

  // Auto-scroll chat log
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomState?.room.match?.roundLogs?.length, revealedAgentLogIds.length]);

  // Reveal and auto-play new agent replies one by one
  useEffect(() => {
    if (!match?.roundLogs) return;

    if (!revealInitializedRef.current) {
      revealInitializedRef.current = true;

      for (const log of match.roundLogs) {
        knownLogIdsRef.current.add(log.id);
        const player = participants.find((participant) => participant.id === log.actorId);
        if (player?.participantType === PARTICIPANT_TYPES.AGENT) {
          revealAgentLog(log.id);
        }
      }
      return;
    }

    const newLogs = [...match.roundLogs]
      .reverse()
      .filter((log) => !knownLogIdsRef.current.has(log.id));

    ttsClientLog('new_logs_detected', {
      count: newLogs.length,
      totalLogs: match.roundLogs.length
    });

    for (const log of newLogs) {
      knownLogIdsRef.current.add(log.id);
      const player = participants.find(p => p.id === log.actorId);
      if (player?.participantType !== PARTICIPANT_TYPES.AGENT) continue;

      const text = log.guessWord?.trim() ?? '';
      if (!text) {
        revealAgentLog(log.id);
        continue;
      }

      revealQueueRef.current.push({
        id: log.id,
        text,
        userId: player.ownerUserId ?? player.userId,
        participantId: player.id
      });
      ttsClientLog('queue_push', {
        logId: log.id,
        participantId: player.id,
        queueLength: revealQueueRef.current.length
      });
    }

    if (revealQueueRef.current.length > 0) {
      void processRevealQueue();
    }
  }, [match?.roundLogs, participants, processRevealQueue, revealAgentLog]);

  useEffect(() => {
    revealedAgentLogIdsRef.current.clear();
    knownLogIdsRef.current.clear();
    revealQueueRef.current = [];
    revealProcessingRef.current = false;
    revealInitializedRef.current = false;
    setRevealedAgentLogIds([]);
  }, [match?.id]);

  // Auto-run agent rounds in AGENT_VS_AGENT mode
  const autoAgentRunningRef = useRef(false);
  useEffect(() => {
    if (
      room?.mode !== GAME_MODES.AGENT_VS_AGENT ||
      room?.status !== 'RUNNING' ||
      !isHost ||
      !currentQuestion ||
      !!busy ||
      isSubmitting ||
      autoAgentRunningRef.current
    ) return;
    autoAgentRunningRef.current = true;
    const delay = match?.roundLogs?.length ? 1000 : 300;
    const timer = setTimeout(() => {
      autoAgentRunningRef.current = false;
      void handleAgentRound();
    }, delay);
    return () => {
      clearTimeout(timer);
      autoAgentRunningRef.current = false;
    };
  }, [room?.mode, room?.status, isHost, currentQuestion, busy, isSubmitting, match?.roundLogs?.length]);

  async function runAction(label: string, action: () => Promise<void>) {
    try {
      setError('');
      setBusy(label);
      await action();
      await fetchRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setBusy('');
    }
  }

  async function handleAgentRound() {
    if (!currentQuestion) return;
    const prevLogCount = match?.roundLogs?.length ?? 0;
    await runAction('Agent 对战中...', async () => {
      await api(`/api/matches/${match!.id}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({
          targetWord: currentQuestion.answer,
          pinyinHint: currentQuestion.initialsText,
          roundIndex: (match?.totalRounds ?? 0) + 1
        })
      });
    });
    const freshState = await api<RoomState>(`/api/rooms/${roomId}/state`).catch(() => null);
    if (freshState) {
      setRoomState(freshState);
      const newLogs = freshState.room.match?.roundLogs ?? [];
      const latestLogs = newLogs.slice(0, newLogs.length - prevLogCount);
      const anyCorrect = latestLogs.some(l => l.isCorrect);
      if (anyCorrect) {
        void fetchQuestion();
      } else {
        setFailedRounds(prev => prev + 1);
      }
    }
  }

  // Agent-only round for when human times out
  async function handleAgentRoundOnly() {
    if (!currentQuestion) return;
    const prevLogCount = match?.roundLogs?.length ?? 0;
    await runAction('超时！Agent 回合中...', async () => {
      await api(`/api/matches/${match!.id}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({
          targetWord: currentQuestion.answer,
          pinyinHint: currentQuestion.initialsText,
          roundIndex: (match?.totalRounds ?? 0) + 1
        })
      });
    });
    const freshState = await api<RoomState>(`/api/rooms/${roomId}/state`).catch(() => null);
    if (freshState) {
      setRoomState(freshState);
      const newLogs = freshState.room.match?.roundLogs ?? [];
      const latestLogs = newLogs.slice(0, newLogs.length - prevLogCount);
      const anyCorrect = latestLogs.some(l => l.isCorrect);
      if (anyCorrect) {
        void fetchQuestion();
      } else {
        setFailedRounds(prev => prev + 1);
      }
    }
  }

  async function handleHumanMove() {
    if (!guessWord.trim()) { setError('请输入你猜测的中文词语'); return; }
    if (!currentQuestion) { setError('正在加载题目...'); return; }

    const prevLogCount = match?.roundLogs?.length ?? 0;
    const submittedWord = guessWord.trim();

    setGuessWord('');
    setError('');
    setIsSubmitting(true);

    let humanMoveResult: HumanMoveResponse;

    try {
      humanMoveResult = await api<HumanMoveResponse>(`/api/matches/${match!.id}/human-move`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: humanParticipant?.id,
          autoAgentResponse: false,
          targetWord: currentQuestion.answer,
          pinyinHint: currentQuestion.initialsText,
          guessWord: submittedWord
        })
      });
    } catch (err) {
      setGuessWord(submittedWord);
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
      await fetchRoom();
      return;
    } finally {
      setIsSubmitting(false);
    }

    await fetchRoom();

    if (humanMoveResult.human.result.isCorrect) {
      await fetchQuestion();
      return;
    }

    if (agentParticipants.length > 0) {
      await runAction('Agent 回答中...', async () => {
        await api(`/api/matches/${match!.id}/agent-round`, {
          method: 'POST',
          body: JSON.stringify({
            targetWord: currentQuestion.answer,
            pinyinHint: currentQuestion.initialsText,
            roundIndex: humanMoveResult.roundIndex
          })
        });
      });
    }

    const freshState = await api<RoomState>(`/api/rooms/${roomId}/state`).catch(() => null);
    if (freshState) {
      setRoomState(freshState);
      const newLogs = freshState.room.match?.roundLogs ?? [];
      const latestLogs = newLogs.slice(0, newLogs.length - prevLogCount);
      const anyCorrect = latestLogs.some((log) => log.isCorrect);
      if (anyCorrect) {
        await fetchQuestion();
      } else if (latestLogs.length > 0) {
        setFailedRounds((prev) => prev + 1);
      }
    }
  }

  async function handleFinish() {
    const winner = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
    const winnerParticipant = winner ? participants.find(p => p.id === winner[0]) : null;
    await runAction('结算对局中...', async () => {
      await api(`/api/rooms/${roomId}/finish`, {
        method: 'POST',
        body: JSON.stringify({
          winnerUserId: winnerParticipant?.userId ?? session?.user?.id,
          totalRounds: match?.totalRounds ?? 1
        })
      });
    });
  }

  // Loading state
  if (!roomState) {
    return (
      <div className="chatroom">
        <div className="chatroom__loading">
          <span className="loading-spinner" />
        </div>
      </div>
    );
  }

  const showHint = failedRounds >= 2 && currentQuestion;
  const timerUrgent = timeLeft !== null && timeLeft <= 30;
  const revealedAgentLogSet = new Set(revealedAgentLogIds);

  return (
    <div className="chatroom">
      <div className="chatroom__container">
        {/* Header Bar */}
        <div className="chatroom__header">
          <div className="chatroom__header-left">
            <span className="chatroom__mode-tag">
              {room?.mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent对战' : '玩家VS Agent'}
            </span>
            <span className="chatroom__round-tag">
              第 {match?.totalRounds || 0} 回合
            </span>
          </div>
          <div className="chatroom__header-right">
            {room?.status === 'RUNNING' && turnTimeLeft !== null && (
              <span className={`chatroom__turn-timer ${turnTimeLeft <= 5 ? 'chatroom__turn-timer--urgent' : ''}`}>
                {turnTimeLeft}s
              </span>
            )}
            {room?.status === 'RUNNING' && timeLeft !== null && (
              <span className={`chatroom__timer ${timerUrgent ? 'chatroom__timer--urgent' : ''}`}>
                {formatTime(timeLeft)}
              </span>
            )}
            <div className={`chatroom__status chatroom__status--${room?.status?.toLowerCase()}`}>
              <span className="chatroom__status-dot" />
              {room?.status === 'WAITING' ? '等待中' : room?.status === 'RUNNING' ? '对战中' : '已结束'}
            </div>
          </div>
        </div>

        {/* Player Cards Grid */}
        <div className="player-cards-grid">
          {rankedParticipants.map((p, idx) => (
            <PlayerCard
              key={p.id}
              participant={p}
              score={scores.get(p.id) ?? 0}
              rank={idx + 1}
            />
          ))}
        </div>

        {/* Hint Display */}
        {room?.status === 'RUNNING' && currentQuestion && (
          <div className="chatroom__hint">
            <div className="chatroom__hint-label">拼音首字母提示</div>
            <div className="chatroom__hint-letters">
              {currentQuestion.initials.map((letter, i) => (
                <span key={i} className="chatroom__hint-letter">{letter}</span>
              ))}
            </div>
            {showHint ? (
              <div className="chatroom__hint-category chatroom__hint-category--reveal">
                提示：{currentQuestion.category}
              </div>
            ) : (
              <div className="chatroom__hint-category">
                {failedRounds > 0 ? `已猜 ${failedRounds} 轮未中，再猜一轮将给出提示` : '请猜词'}
              </div>
            )}
          </div>
        )}

        {/* Chat Messages Area - Left/Right Layout */}
        <div className="chatroom__messages">
          {error && <div className="alert alert--error mb-md">{error}</div>}
          {(busy || isSubmitting) && (
            <div className="chatroom__system-msg">
              <span className="loading-spinner" /> {isSubmitting ? '提交猜词中...' : busy}
            </div>
          )}

          {room?.status === 'WAITING' && (
            <div className="chatroom__system-msg">
              房间已创建，等待开始...共 {participants.length} 名参与者
            </div>
          )}

          {match?.roundLogs && match.roundLogs.length > 0 && (
            <>
              {match.roundLogs.map((log) => {
                const player = participants.find(p => p.id === log.actorId);
                const isMe = player?.userId === session?.user?.id;
                const isAgent = player?.participantType === PARTICIPANT_TYPES.AGENT;
                if (isAgent && !revealedAgentLogSet.has(log.id)) {
                  return null;
                }
                return (
                  <div
                    key={log.id}
                    className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'}`}
                  >
                    {!isMe && player && <MiniAvatar participant={player} />}
                    <div className="chat-bubble__body">
                      <div className="chat-bubble__sender">
                        {player?.displayName ?? '?'}
                        <span className="chat-bubble__round">R{log.roundIndex}</span>
                        {isAgent && (
                          <span className="chat-bubble__tts-icon" title="语音播放" onClick={() => {
                            if (log.guessWord) {
                              void playTTSWithRetry(log.guessWord, {
                                userId: player?.ownerUserId ?? player?.userId,
                                participantId: player?.id
                              });
                            }
                          }}>
                            &#9835;
                          </span>
                        )}
                      </div>
                      <div className="chat-bubble__content">
                        <span className="chat-bubble__word">{log.guessWord}</span>
                        <span className={`chat-bubble__result ${log.isCorrect ? 'chat-bubble__result--correct' : 'chat-bubble__result--wrong'}`}>
                          {log.isCorrect ? '+1' : '未中'}
                        </span>
                      </div>
                    </div>
                    {isMe && player && <MiniAvatar participant={player} />}
                  </div>
                );
              })}
            </>
          )}

          {room?.status === 'FINISHED' && (
            <div className="chatroom__finish-card">
              <h2>{timeLeft === 0 ? '时间到！' : '对局结束！'}</h2>
              <div className="chatroom__final-ranking">
                {rankedParticipants.map((p, idx) => (
                  <div key={p.id} className="chatroom__rank-item">
                    <span className="chatroom__rank-pos">#{idx + 1}</span>
                    <span className="chatroom__rank-name">{p.displayName}</span>
                    <span className="chatroom__rank-score">{scores.get(p.id) ?? 0} 分</span>
                  </div>
                ))}
              </div>
              <div className="chatroom__finish-actions">
                {match && (
                  <Link href={`/results/${match.id}`} className="btn btn--gradient">
                    查看战报
                  </Link>
                )}
                <Link href="/" className="btn btn--secondary">
                  再来一局
                </Link>
                <Link href="/leaderboard" className="btn btn--ghost">
                  排行榜
                </Link>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Bar */}
        {room?.status === 'RUNNING' && match && (
          <div className="chatroom__input-bar">
            {isHost && room.mode === GAME_MODES.AGENT_VS_AGENT ? (
              <div className="chatroom__agent-controls">
                <button
                  type="button"
                  className="btn btn--primary btn--full"
                  onClick={() => void handleAgentRound()}
                  disabled={!!busy || isSubmitting}
                >
                  运行 Agent 回合
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => void handleFinish()}
                  disabled={!!busy || isSubmitting}
                >
                  结束对局
                </button>
              </div>
            ) : room.mode === GAME_MODES.HUMAN_VS_AGENT ? (
              <>
                <div className="chatroom__guess-row">
                  <input
                    className="chatroom__guess-input"
                    value={guessWord}
                    onChange={e => setGuessWord(e.target.value)}
                    placeholder="输入你猜的中文词语..."
                    onKeyDown={e => { if (e.key === 'Enter') void handleHumanMove(); }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary chatroom__send-btn"
                    onClick={() => void handleHumanMove()}
                    disabled={!!busy || isSubmitting}
                  >
                    发送
                  </button>
                </div>
                {isHost && (
                  <button
                    type="button"
                    className="btn btn--accent btn--sm"
                    onClick={() => void handleFinish()}
                    disabled={!!busy || isSubmitting}
                    style={{ marginTop: 'var(--space-xs)' }}
                  >
                    结束对局
                  </button>
                )}
              </>
            ) : (
              <div className="chatroom__system-msg">等待房主操作...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
