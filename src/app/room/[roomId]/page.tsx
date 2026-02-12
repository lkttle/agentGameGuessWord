'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  skipped?: boolean;
  reason?: string;
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
let activeAudioElement: HTMLAudioElement | null = null;
let reusableAudioElement: HTMLAudioElement | null = null;
let ttsSessionVersion = 0;
let audioUnlocked = false;
let audioUnlockPromise: Promise<void> | null = null;
const MAX_TTS_ATTEMPTS = 3;
const AGENT_REPLY_GAP_MS = 300;
const SILENT_AUDIO_DATA_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

interface PlayTTSOptions {
  userId?: string | null;
  participantId?: string;
  onPlaybackStart?: (payload: { durationMs: number | null }) => void;
}

function getReusableAudio(): HTMLAudioElement {
  if (!reusableAudioElement) {
    reusableAudioElement = new Audio();
    reusableAudioElement.preload = 'auto';
    reusableAudioElement.setAttribute('playsinline', 'true');
    reusableAudioElement.setAttribute('webkit-playsinline', 'true');
  }
  return reusableAudioElement;
}

async function unlockAudioPlayback(trigger: string): Promise<void> {
  if (audioUnlocked) return;

  if (audioUnlockPromise) {
    await audioUnlockPromise;
    return;
  }

  audioUnlockPromise = (async () => {
    try {
      const audio = getReusableAudio();
      audio.muted = true;
      audio.src = SILENT_AUDIO_DATA_URL;
      audio.currentTime = 0;
      await audio.play();
      audio.muted = false;
      audioUnlocked = true;
      ttsClientLog('audio_unlock_success', { trigger });

      setTimeout(() => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }, 120);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('interrupted by a call to pause')) {
        audioUnlocked = true;
        ttsClientLog('audio_unlock_soft_success', { trigger, error: message });
      }

      ttsClientLog('audio_unlock_failed', {
        trigger,
        error: message
      });
    } finally {
      const audio = getReusableAudio();
      audio.muted = false;
      audioUnlockPromise = null;
    }
  })();

  await audioUnlockPromise;
}

function stopAllTTSPlayback(): void {
  ttsSessionVersion += 1;
  ttsQueue.length = 0;
  ttsProcessing = false;
  audioUnlockPromise = null;
  if (activeAudioElement) {
    activeAudioElement.onended = null;
    activeAudioElement.onerror = null;
    activeAudioElement.pause();
    activeAudioElement.currentTime = 0;
    activeAudioElement.src = '';
    activeAudioElement = null;
  }

  if (reusableAudioElement) {
    reusableAudioElement.pause();
    reusableAudioElement.currentTime = 0;
    reusableAudioElement.src = '';
  }
}

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

function questionToKey(question: PinyinQuestion | null): string {
  if (!question) return '';
  return `${question.initialsText}|${question.answer}|${question.category}`;
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) return null;

  const mimeType = match[1] || 'audio/mpeg';
  const base64 = match[2];

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
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
  options?: PlayTTSOptions
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const sessionVersion = ttsSessionVersion;

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
        if (sessionVersion !== ttsSessionVersion) {
          return settle(false);
        }

        if (!audioUnlocked) {
          await unlockAudioPlayback('tts_attempt');
        }

        if (sessionVersion !== ttsSessionVersion) {
          return settle(false);
        }

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

        if (sessionVersion !== ttsSessionVersion) {
          return settle(false);
        }

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
        const durationMs =
          typeof json?.data?.durationMs === 'number' ? json.data.durationMs : null;

        if (sessionVersion !== ttsSessionVersion) {
          return settle(false);
        }

        ttsClientLog('request_success', {
          requestId: json?.requestId ?? res.headers.get('x-tts-request-id') ?? null,
          hasUrl: Boolean(url),
          durationMs
        });
        if (!url) {
          ttsClientLog('request_missing_url', { response: json });
          return settle(false);
        }

        const audio = getReusableAudio();
        let blobUrl: string | null = null;
        let playbackUrl = url;

        if (url.startsWith('data:')) {
          blobUrl = dataUrlToBlobUrl(url);
          if (blobUrl) {
            playbackUrl = blobUrl;
            ttsClientLog('audio_url_blob_proxy', {
              participantId: options?.participantId ?? null
            });
          } else {
            ttsClientLog('audio_url_blob_proxy_failed', {
              participantId: options?.participantId ?? null
            });
          }
        }

        audio.pause();
        audio.currentTime = 0;
        audio.src = playbackUrl;
        audio.volume = 0.7;
        audio.muted = false;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        activeAudioElement = audio;
        ttsClientLog('audio_play_start', {
          url,
          participantId: options?.participantId ?? null,
          audioUnlocked
        });

        const played = await new Promise<boolean>((audioResolve) => {
          let playbackStartNotified = false;
          const notifyPlaybackStart = () => {
            if (playbackStartNotified) return;
            playbackStartNotified = true;
            options?.onPlaybackStart?.({ durationMs });
          };

          const fallbackTimer = setTimeout(() => {
            audio.pause();
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
            if (activeAudioElement === audio) {
              activeAudioElement = null;
            }
            audioResolve(false);
          }, 10000);

          if (sessionVersion !== ttsSessionVersion) {
            clearTimeout(fallbackTimer);
            audio.pause();
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
            if (activeAudioElement === audio) {
              activeAudioElement = null;
            }
            audioResolve(false);
            return;
          }

          audio.onended = () => {
            clearTimeout(fallbackTimer);
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
            if (activeAudioElement === audio) {
              activeAudioElement = null;
            }
            ttsClientLog('audio_onended', {
              participantId: options?.participantId ?? null
            });
            audioResolve(true);
          };
          audio.onerror = () => {
            clearTimeout(fallbackTimer);
            audio.pause();
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
            if (activeAudioElement === audio) {
              activeAudioElement = null;
            }
            ttsClientLog('audio_onerror', {
              participantId: options?.participantId ?? null,
              url
            });
            audioResolve(false);
          };

          const playResult = audio.play();
          if (playResult && typeof playResult.then === 'function') {
            playResult
              .then(() => {
                if (sessionVersion === ttsSessionVersion) {
                  notifyPlaybackStart();
                }
              })
              .catch((error) => {
                clearTimeout(fallbackTimer);
                audio.pause();
                if (blobUrl) {
                  URL.revokeObjectURL(blobUrl);
                  blobUrl = null;
                }
                if (activeAudioElement === audio) {
                  activeAudioElement = null;
                }

                if (!audioUnlocked) {
                  void unlockAudioPlayback('play_rejected_retry');
                }

                ttsClientLog('audio_play_rejected', {
                  participantId: options?.participantId ?? null,
                  audioUnlocked,
                  error: error instanceof Error ? error.message : String(error)
                });
                audioResolve(false);
              });
            return;
          }

          notifyPlaybackStart();
        });

        return settle(played);
      } catch (error) {
        ttsClientLog('request_exception', {
          error: error instanceof Error ? error.message : String(error),
          participantId: options?.participantId ?? null
        });
        if (activeAudioElement) {
          activeAudioElement.pause();
          activeAudioElement = null;
        }
        return settle(false);
      }
    });

    void drainTtsQueue();
  });
}

async function playTTSWithRetry(
  text: string,
  options?: PlayTTSOptions
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
function PlayerCard({ participant, score, rank, latestAnswer, onTtsPlay }: {
  participant: Participant;
  score: number;
  rank: number;
  latestAnswer?: { guessWord: string; isCorrect: boolean; roundIndex: number } | null;
  onTtsPlay?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = participant.displayName.charAt(0).toUpperCase();
  const isHuman = participant.participantType === PARTICIPANT_TYPES.HUMAN;
  const isAgent = participant.participantType === PARTICIPANT_TYPES.AGENT;
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
        <div className="player-card__name-row">
          <span className="player-card__name">{participant.displayName}</span>
          {participant.selfIntroduction && (
            <span className="player-card__intro">{participant.selfIntroduction}</span>
          )}
        </div>
        <div className="player-card__badge-row">
          <span className={`player-card__badge ${isHuman ? 'player-card__badge--human' : 'player-card__badge--agent'}`}>
            {label}
          </span>
          <span className="player-card__score">{score} 分</span>
        </div>
        {latestAnswer ? (
          <div className={`player-card__answer ${latestAnswer.isCorrect ? 'player-card__answer--correct' : 'player-card__answer--wrong'}`}>
            <span className="player-card__answer-word">{latestAnswer.guessWord}</span>
            <span className="player-card__answer-result">
              {latestAnswer.isCorrect ? '+1' : '未中'}
            </span>
            {isAgent && onTtsPlay && (
              <span className="player-card__answer-tts" title="语音播放" onClick={onTtsPlay}>
                &#9835;
              </span>
            )}
          </div>
        ) : (
          <div className="player-card__answer player-card__answer--empty" />
        )}
      </div>
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);
  const [currentTurnParticipantId, setCurrentTurnParticipantId] = useState<string | null>(null);
  const currentTurnParticipantIdRef = useRef<string | null>(null);
  const nextQuestionStarterIdRef = useRef<string | null>(null);
  const answeredParticipantsRef = useRef(new Set<string>());
  const [activeRoundIndex, setActiveRoundIndex] = useState(1);
  const activeRoundIndexRef = useRef(1);
  const currentRoundLogIdsRef = useRef(new Set<string>());
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
    questionKey?: string;
  }>>([]);
  const revealProcessingRef = useRef(false);
  const revealInitializedRef = useRef(false);
  const pageActiveRef = useRef(true);
  const runningActionRef = useRef(false);
  const playedAgentLogIdsRef = useRef(new Set<string>());
  const switchingQuestionRef = useRef(false);
  const autoAgentRunningRef = useRef(false);
  const currentQuestionKeyRef = useRef('');
  const [revealedAgentLogIds, setRevealedAgentLogIds] = useState<string[]>([]);
  const [agentRevealTextMap, setAgentRevealTextMap] = useState<Record<string, string>>({});
  const agentRevealTimersRef = useRef(new Map<string, ReturnType<typeof setInterval>>());

  const revealAgentLog = useCallback((logId: string) => {
    if (revealedAgentLogIdsRef.current.has(logId)) return;
    revealedAgentLogIdsRef.current.add(logId);
    setRevealedAgentLogIds((prev) => (prev.includes(logId) ? prev : [...prev, logId]));
  }, []);

  const clearAgentRevealTimers = useCallback(() => {
    for (const timer of agentRevealTimersRef.current.values()) {
      clearInterval(timer);
    }
    agentRevealTimersRef.current.clear();
    setAgentRevealTextMap({});
  }, []);

  const startAgentTextReveal = useCallback((
    logId: string,
    fullText: string,
    durationMs: number | null
  ) => {
    const text = fullText.trim();
    const existingTimer = agentRevealTimersRef.current.get(logId);
    if (existingTimer) {
      clearInterval(existingTimer);
      agentRevealTimersRef.current.delete(logId);
    }

    if (!text) {
      setAgentRevealTextMap((prev) => {
        if (!(logId in prev)) return prev;
        const next = { ...prev };
        delete next[logId];
        return next;
      });
      return;
    }

    const chars = Array.from(text);
    if (chars.length <= 1) {
      setAgentRevealTextMap((prev) => (prev[logId] === text ? prev : { ...prev, [logId]: text }));
      return;
    }

    const targetDuration = Math.max(900, Math.min(6000, durationMs ?? chars.length * 220));
    const stepMs = Math.max(60, Math.floor(targetDuration / chars.length));
    let index = 0;

    setAgentRevealTextMap((prev) => ({ ...prev, [logId]: '' }));

    const timer = setInterval(() => {
      if (!pageActiveRef.current) {
        clearInterval(timer);
        agentRevealTimersRef.current.delete(logId);
        return;
      }

      index += 1;
      const nextText = chars.slice(0, index).join('');
      setAgentRevealTextMap((prev) => (prev[logId] === nextText ? prev : { ...prev, [logId]: nextText }));

      if (index >= chars.length) {
        clearInterval(timer);
        agentRevealTimersRef.current.delete(logId);
      }
    }, stepMs);

    agentRevealTimersRef.current.set(logId, timer);
  }, []);

  const processRevealQueue = useCallback(async () => {
    if (!pageActiveRef.current || revealProcessingRef.current) return;
    revealProcessingRef.current = true;
    const revealSessionVersion = ttsSessionVersion;
    ttsClientLog('reveal_queue_start', {
      queueLength: revealQueueRef.current.length,
      sessionVersion: revealSessionVersion
    });

    while (pageActiveRef.current && revealQueueRef.current.length > 0) {
      if (revealSessionVersion !== ttsSessionVersion) {
        ttsClientLog('reveal_queue_session_changed_break', {
          queueLeft: revealQueueRef.current.length,
          sessionVersion: revealSessionVersion,
          currentSessionVersion: ttsSessionVersion
        });
        break;
      }

      const next = revealQueueRef.current.shift();
      if (!next) continue;

      if (
        next.questionKey &&
        currentQuestionKeyRef.current &&
        next.questionKey !== currentQuestionKeyRef.current
      ) {
        ttsClientLog('reveal_skip_stale_question', {
          logId: next.id,
          queueQuestionKey: next.questionKey,
          currentQuestionKey: currentQuestionKeyRef.current
        });
        continue;
      }

      ttsClientLog('reveal_next', {
        logId: next.id,
        participantId: next.participantId ?? null,
        queueLeft: revealQueueRef.current.length
      });

      let textShown = false;
      const revealTextNow = (durationMs: number | null) => {
        if (textShown) return;
        textShown = true;
        revealAgentLog(next.id);
        startAgentTextReveal(next.id, next.text, durationMs);
      };

      const revealFallbackTimer = setTimeout(() => {
        revealTextNow(null);
      }, 900);

      const played = await playTTSWithRetry(next.text, {
        userId: next.userId,
        participantId: next.participantId,
        onPlaybackStart: ({ durationMs }) => {
          clearTimeout(revealFallbackTimer);
          revealTextNow(durationMs);
        }
      });

      clearTimeout(revealFallbackTimer);
      if (!textShown) {
        revealTextNow(null);
      }

      playedAgentLogIdsRef.current.add(next.id);
      ttsClientLog('reveal_tts_result', {
        logId: next.id,
        participantId: next.participantId ?? null,
        played
      });

      if (!pageActiveRef.current || revealSessionVersion !== ttsSessionVersion) break;
      if (revealQueueRef.current.length > 0) {
        await sleep(AGENT_REPLY_GAP_MS);
      }
    }

    revealProcessingRef.current = false;
    ttsClientLog('reveal_queue_end');
  }, [revealAgentLog, startAgentTextReveal]);

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
  const orderedParticipants = useMemo(() => {
    const base = [...participants].sort((a, b) => a.seatOrder - b.seatOrder);
    if (room?.mode === GAME_MODES.AGENT_VS_AGENT) {
      return base.filter((participant) => participant.participantType === PARTICIPANT_TYPES.AGENT);
    }
    return base;
  }, [participants, room?.mode]);

  const getNextParticipantId = useCallback((participantId: string | null): string | null => {
    if (!participantId || orderedParticipants.length < 1) {
      return orderedParticipants[0]?.id ?? null;
    }
    const index = orderedParticipants.findIndex((participant) => participant.id === participantId);
    if (index < 0) {
      return orderedParticipants[0]?.id ?? null;
    }
    return orderedParticipants[(index + 1) % orderedParticipants.length]?.id ?? null;
  }, [orderedParticipants]);

  const currentTurnParticipant = orderedParticipants.find((participant) => participant.id === currentTurnParticipantId) ?? null;
  const isHumanTurn = currentTurnParticipant?.participantType === PARTICIPANT_TYPES.HUMAN;

  // Rank participants by score
  const rankedParticipants = [...participants].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
  );

  const stopRoomRuntime = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    revealQueueRef.current = [];
    revealProcessingRef.current = false;
    autoAgentRunningRef.current = false;
    turnSkippingRef.current = true;
    clearAgentRevealTimers();
    stopAllTTSPlayback();
  }, [clearAgentRevealTimers]);

  const fetchRoom = useCallback(async () => {
    if (!pageActiveRef.current) return;
    try {
      const data = await api<RoomState>(`/api/rooms/${roomId}/state`);
      if (!pageActiveRef.current) return;
      setRoomState(data);
    } catch {
      // Silently handle polling errors
    }
  }, [roomId]);

  // Fetch a new question from the API
  const fetchQuestion = useCallback(async (mode: 'initial' | 'next' = 'next') => {
    if (switchingQuestionRef.current) {
      return;
    }

    switchingQuestionRef.current = true;
    revealQueueRef.current = [];
    revealProcessingRef.current = false;
    clearAgentRevealTimers();
    stopAllTTSPlayback();
    answeredParticipantsRef.current.clear();
    currentRoundLogIdsRef.current.clear();

    const nextRoundIndex = mode === 'initial'
      ? (match?.totalRounds ?? 0) + 1
      : activeRoundIndexRef.current + 1;
    activeRoundIndexRef.current = nextRoundIndex;
    setActiveRoundIndex(nextRoundIndex);

    let nextStarterId = nextQuestionStarterIdRef.current;
    if (!nextStarterId || !orderedParticipants.some((participant) => participant.id === nextStarterId)) {
      nextStarterId = orderedParticipants[0]?.id ?? null;
      nextQuestionStarterIdRef.current = nextStarterId;
    }
    currentTurnParticipantIdRef.current = nextStarterId;
    setCurrentTurnParticipantId(nextStarterId);

    try {
      const res = await api<{ questions: PinyinQuestion[] }>('/api/questions/generate', {
        method: 'POST',
        body: JSON.stringify({ count: 1 })
      });
      if (!pageActiveRef.current) return;
      if (res.questions.length > 0) {
        setCurrentQuestion(res.questions[0]);
      }
    } catch {
      if (!pageActiveRef.current) return;
      setCurrentQuestion({
        initials: ['C', 'F'],
        initialsText: 'CF',
        answer: '吃饭',
        category: '动作'
      });
    } finally {
      switchingQuestionRef.current = false;
    }
  }, [clearAgentRevealTimers, match?.totalRounds, orderedParticipants]);

  const appendCurrentRoundLogIds = useCallback((logs: RoundLogEntry[]) => {
    const nextIds: string[] = [];
    for (const log of logs) {
      if (log.roundIndex !== activeRoundIndexRef.current) {
        continue;
      }
      if (!currentRoundLogIdsRef.current.has(log.id)) {
        currentRoundLogIdsRef.current.add(log.id);
        nextIds.push(log.id);
      }
    }

    if (nextIds.length > 0) {
      ttsClientLog('current_round_logs_append', {
        roundIndex: activeRoundIndexRef.current,
        appendedCount: nextIds.length
      });
    }
  }, []);

  const finalizeTurnAndMaybeSwitchQuestion = useCallback(async (
    actorParticipantId: string,
    isCorrect: boolean,
    questionKey?: string
  ) => {
    if (questionKey && currentQuestionKeyRef.current !== questionKey) {
      return;
    }

    const nextParticipantId = getNextParticipantId(actorParticipantId);

    if (isCorrect) {
      nextQuestionStarterIdRef.current = nextParticipantId;
      await fetchQuestion('next');
      return;
    }

    answeredParticipantsRef.current.add(actorParticipantId);
    const hasCompletedOneRound = answeredParticipantsRef.current.size >= Math.max(1, orderedParticipants.length);

    if (hasCompletedOneRound) {
      nextQuestionStarterIdRef.current = nextParticipantId;
      await fetchQuestion('next');
      return;
    }

    currentTurnParticipantIdRef.current = nextParticipantId;
    setCurrentTurnParticipantId(nextParticipantId);
  }, [fetchQuestion, getNextParticipantId, orderedParticipants.length]);

  useEffect(() => {
    currentQuestionKeyRef.current = questionToKey(currentQuestion);
  }, [currentQuestion]);

  useEffect(() => {
    if (orderedParticipants.length < 1) {
      currentTurnParticipantIdRef.current = null;
      nextQuestionStarterIdRef.current = null;
      setCurrentTurnParticipantId(null);
      return;
    }

    if (!nextQuestionStarterIdRef.current || !orderedParticipants.some((participant) => participant.id === nextQuestionStarterIdRef.current)) {
      nextQuestionStarterIdRef.current = orderedParticipants[0].id;
    }

    if (!currentTurnParticipantId || !orderedParticipants.some((participant) => participant.id === currentTurnParticipantId)) {
      const starterId = nextQuestionStarterIdRef.current;
      currentTurnParticipantIdRef.current = starterId;
      setCurrentTurnParticipantId(starterId);
    }
  }, [orderedParticipants, currentTurnParticipantId]);

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
      void fetchQuestion('initial');
    }
  }, [room?.status, currentQuestion, fetchQuestion]);

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

  // Per-turn 20s timer - restart on participant turn change
  useEffect(() => {
    if (room?.status !== 'RUNNING' || !currentQuestion || !currentTurnParticipantId || isSubmitting || !!busy) {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      setTurnTimeLeft(null);
      return;
    }

    setTurnTimeLeft(20);
    turnSkippingRef.current = false;
    turnTimerRef.current = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    };
  }, [room?.status, currentQuestion, currentTurnParticipantId, isSubmitting, busy]);

  // Auto-skip turn when per-turn timer reaches 0
  useEffect(() => {
    if (
      turnTimeLeft !== 0 ||
      !currentQuestion ||
      room?.status !== 'RUNNING' ||
      turnSkippingRef.current ||
      isSubmitting ||
      !!busy ||
      !currentTurnParticipant
    ) {
      return;
    }

    turnSkippingRef.current = true;
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);

    const questionKey = currentQuestionKeyRef.current;
    if (currentTurnParticipant.participantType === PARTICIPANT_TYPES.AGENT) {
      void handleAgentTurn(currentTurnParticipant.id, '超时，Agent 回答中...');
      return;
    }

    if (questionKey) {
      void finalizeTurnAndMaybeSwitchQuestion(currentTurnParticipant.id, false, questionKey);
    }
  }, [
    turnTimeLeft,
    room?.status,
    currentQuestion,
    currentTurnParticipant,
    isSubmitting,
    busy,
    finalizeTurnAndMaybeSwitchQuestion
  ]);

  // Polling
  useEffect(() => {
    if (!roomId) return;
    pollingRef.current = setInterval(() => { void fetchRoom(); }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [roomId, fetchRoom]);

  useEffect(() => {
    const onUserGesture = () => {
      void unlockAudioPlayback('user_gesture');
    };

    window.addEventListener('pointerdown', onUserGesture, { passive: true });
    window.addEventListener('touchstart', onUserGesture, { passive: true });
    window.addEventListener('keydown', onUserGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
      pageActiveRef.current = false;
      runningActionRef.current = false;
      stopRoomRuntime();
    };
  }, [stopRoomRuntime]);

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
        if (log.roundIndex === activeRoundIndexRef.current) {
          currentRoundLogIdsRef.current.add(log.id);
        }

        const player = participants.find((participant) => participant.id === log.actorId);
        if (
          player?.participantType === PARTICIPANT_TYPES.AGENT &&
          log.roundIndex === activeRoundIndexRef.current
        ) {
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
      totalLogs: match.roundLogs.length,
      activeRoundIndex: activeRoundIndexRef.current
    });

    appendCurrentRoundLogIds(newLogs);

    for (const log of newLogs) {
      knownLogIdsRef.current.add(log.id);

      if (log.roundIndex !== activeRoundIndexRef.current) {
        continue;
      }

      const player = participants.find((participant) => participant.id === log.actorId);
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
        participantId: player.id,
        questionKey: currentQuestionKeyRef.current
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
  }, [match?.roundLogs, participants, processRevealQueue, revealAgentLog, appendCurrentRoundLogIds]);

  useEffect(() => {
    revealedAgentLogIdsRef.current.clear();
    playedAgentLogIdsRef.current.clear();
    knownLogIdsRef.current.clear();
    revealQueueRef.current = [];
    revealProcessingRef.current = false;
    revealInitializedRef.current = false;
    answeredParticipantsRef.current.clear();
    currentRoundLogIdsRef.current.clear();
    setRevealedAgentLogIds([]);
    clearAgentRevealTimers();
    stopAllTTSPlayback();

    const starterId = orderedParticipants[0]?.id ?? null;
    nextQuestionStarterIdRef.current = starterId;
    currentTurnParticipantIdRef.current = starterId;
    setCurrentTurnParticipantId(starterId);
    setCurrentQuestion(null);

    const nextRoundIndex = (match?.totalRounds ?? 0) + 1;
    activeRoundIndexRef.current = nextRoundIndex;
    setActiveRoundIndex(nextRoundIndex);
  }, [match?.id, match?.totalRounds, orderedParticipants, clearAgentRevealTimers]);

  useEffect(() => {
    if (room?.status === 'FINISHED') {
      stopRoomRuntime();
    }
  }, [room?.status, stopRoomRuntime]);

  // Auto-run current agent turn when it is agent's seat
  useEffect(() => {
    if (
      room?.status !== 'RUNNING' ||
      !isHost ||
      !currentQuestion ||
      !currentTurnParticipant ||
      currentTurnParticipant.participantType !== PARTICIPANT_TYPES.AGENT ||
      switchingQuestionRef.current ||
      !!busy ||
      isSubmitting ||
      autoAgentRunningRef.current ||
      runningActionRef.current
    ) {
      return;
    }

    autoAgentRunningRef.current = true;
    const delay = match?.roundLogs?.length ? 900 : 300;
    const timer = setTimeout(() => {
      autoAgentRunningRef.current = false;
      void handleAgentTurn(currentTurnParticipant.id);
    }, delay);

    return () => {
      clearTimeout(timer);
      autoAgentRunningRef.current = false;
    };
  }, [
    room?.status,
    isHost,
    currentQuestion,
    currentTurnParticipant,
    busy,
    isSubmitting,
    match?.roundLogs?.length
  ]);

  async function runAction(label: string, action: () => Promise<void>): Promise<boolean> {
    if (!pageActiveRef.current || runningActionRef.current) {
      return false;
    }

    runningActionRef.current = true;
    try {
      setError('');
      setBusy(label);
      await action();
      if (!pageActiveRef.current) {
        return false;
      }
      await fetchRoom();
      return true;
    } catch (err) {
      if (pageActiveRef.current) {
        setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
      }
      return false;
    } finally {
      runningActionRef.current = false;
      if (pageActiveRef.current) {
        setBusy('');
      }
    }
  }

  async function handleAgentTurn(participantId: string, label = 'Agent 回答中...') {
    if (!currentQuestion || !pageActiveRef.current || switchingQuestionRef.current) return;
    const questionKey = currentQuestionKeyRef.current;
    if (!questionKey) return;

    const prevLogCount = match?.roundLogs?.length ?? 0;
    const roundIndex = activeRoundIndexRef.current;

    const completed = await runAction(label, async () => {
      await api(`/api/matches/${match!.id}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({
          participantId,
          targetWord: currentQuestion.answer,
          pinyinHint: currentQuestion.initialsText,
          categoryHint: currentQuestion.category,
          questionKey,
          roundIndex
        })
      });
    });
    if (!completed || !pageActiveRef.current) return;

    const freshState = await api<RoomState>(`/api/rooms/${roomId}/state`).catch(() => null);
    if (freshState && pageActiveRef.current) {
      setRoomState(freshState);
      if (!questionKey || currentQuestionKeyRef.current !== questionKey) {
        return;
      }

      const newLogs = freshState.room.match?.roundLogs ?? [];
      const latestLogs = newLogs.slice(0, newLogs.length - prevLogCount);
      appendCurrentRoundLogIds(latestLogs);

      const participantLog = latestLogs.find((log) =>
        log.actorId === participantId && log.roundIndex === activeRoundIndexRef.current
      );
      const isCorrect = participantLog?.isCorrect ?? false;
      await finalizeTurnAndMaybeSwitchQuestion(participantId, isCorrect, questionKey);
    }
  }

  async function handleHumanMove() {
    if (!pageActiveRef.current || switchingQuestionRef.current || runningActionRef.current) return;
    if (!currentQuestion) { setError('正在加载题目...'); return; }
    if (!humanParticipant) { setError('当前房间没有玩家身份'); return; }
    if (currentTurnParticipantId !== humanParticipant.id) {
      setError('当前还没轮到你作答，请等待其他参与者。');
      return;
    }
    if (!guessWord.trim()) { setError('请输入你猜测的中文词语'); return; }

    const questionKey = currentQuestionKeyRef.current;
    if (!questionKey) return;

    const prevLogCount = match?.roundLogs?.length ?? 0;
    const submittedWord = guessWord.trim();
    const roundIndex = activeRoundIndexRef.current;

    setGuessWord('');
    setError('');
    setIsSubmitting(true);

    let humanMoveResult: HumanMoveResponse;

    try {
      humanMoveResult = await api<HumanMoveResponse>(`/api/matches/${match!.id}/human-move`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: humanParticipant.id,
          autoAgentResponse: false,
          targetWord: currentQuestion.answer,
          pinyinHint: currentQuestion.initialsText,
          categoryHint: currentQuestion.category,
          questionKey,
          guessWord: submittedWord,
          roundIndex
        })
      });

      if (humanMoveResult.skipped) {
        await fetchRoom();
        return;
      }
    } catch (err) {
      if (!pageActiveRef.current) return;
      setGuessWord(submittedWord);
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
      await fetchRoom();
      return;
    } finally {
      if (pageActiveRef.current) {
        setIsSubmitting(false);
      }
    }

    if (!pageActiveRef.current) return;

    const freshState = await api<RoomState>(`/api/rooms/${roomId}/state`).catch(() => null);
    if (freshState && pageActiveRef.current) {
      setRoomState(freshState);
      if (!questionKey || currentQuestionKeyRef.current !== questionKey) {
        return;
      }

      const newLogs = freshState.room.match?.roundLogs ?? [];
      const latestLogs = newLogs.slice(0, newLogs.length - prevLogCount);
      appendCurrentRoundLogIds(latestLogs);
      await finalizeTurnAndMaybeSwitchQuestion(
        humanParticipant.id,
        humanMoveResult.human.result.isCorrect,
        questionKey
      );
    }
  }

  async function handleFinish() {
    if (!pageActiveRef.current) return;
    stopRoomRuntime();
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

  const timerUrgent = timeLeft !== null && timeLeft <= 30;
  const revealedAgentLogSet = new Set(revealedAgentLogIds);

  // Compute latest answer per participant for player cards
  const latestAnswers = new Map<string, { guessWord: string; isCorrect: boolean; roundIndex: number }>();
  if (match?.roundLogs) {
    for (const log of match.roundLogs) {
      if (log.roundIndex !== activeRoundIndexRef.current) {
        continue;
      }
      if (!currentRoundLogIdsRef.current.has(log.id)) {
        continue;
      }
      const player = participants.find(p => p.id === log.actorId);
      const isAgent = player?.participantType === PARTICIPANT_TYPES.AGENT;
      if (isAgent && !revealedAgentLogSet.has(log.id)) continue;
      const renderedGuessWord = isAgent ? (agentRevealTextMap[log.id] ?? log.guessWord) : log.guessWord;
      latestAnswers.set(log.actorId, {
        guessWord: renderedGuessWord,
        isCorrect: log.isCorrect,
        roundIndex: log.roundIndex,
      });
    }
  }

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
              第 {room?.status === 'RUNNING' ? activeRoundIndex : (match?.totalRounds || 0)} 回合
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
              latestAnswer={latestAnswers.get(p.id) ?? null}
              onTtsPlay={p.participantType === PARTICIPANT_TYPES.AGENT ? () => {
                const answer = latestAnswers.get(p.id);
                if (answer?.guessWord) {
                  void unlockAudioPlayback('manual_tts_click');
                  void playTTSWithRetry(answer.guessWord, {
                    userId: p.ownerUserId ?? p.userId,
                    participantId: p.id
                  });
                }
              } : undefined}
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
            <div className="chatroom__hint-category chatroom__hint-category--reveal">
              提示：{currentQuestion.category}
            </div>
            <div className="chatroom__hint-category">
              当前轮到：{currentTurnParticipant?.displayName ?? '等待中'}
            </div>
          </div>
        )}

        {/* Messages Area - System messages & Finish card */}
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
                <Link href="/" className="btn btn--secondary" onClick={() => stopRoomRuntime()}>
                  再来一局
                </Link>
                <Link href="/leaderboard" className="btn btn--ghost" onClick={() => stopRoomRuntime()}>
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
                  onClick={() => {
                    if (currentTurnParticipant?.participantType === PARTICIPANT_TYPES.AGENT) {
                      void handleAgentTurn(currentTurnParticipant.id);
                    }
                  }}
                  disabled={!!busy || isSubmitting || currentTurnParticipant?.participantType !== PARTICIPANT_TYPES.AGENT}
                >
                  运行 Agent 回合
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => {
                    stopRoomRuntime();
                    void handleFinish();
                  }}
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
                    placeholder={isHumanTurn ? '输入你猜的中文词语...' : '当前未轮到你作答'}
                    onKeyDown={e => { if (e.key === 'Enter' && isHumanTurn) void handleHumanMove(); }}
                    disabled={!isHumanTurn || !!busy || isSubmitting}
                  />
                  <button
                    type="button"
                    className="btn btn--primary chatroom__send-btn"
                    onClick={() => void handleHumanMove()}
                    disabled={!isHumanTurn || !!busy || isSubmitting}
                  >
                    发送
                  </button>
                </div>
                {isHost && (
                  <button
                    type="button"
                    className="btn btn--accent btn--sm"
                    onClick={() => {
                      stopRoomRuntime();
                      void handleFinish();
                    }}
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
