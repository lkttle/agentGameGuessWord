import { ParticipantType, type User } from '@prisma/client';
import { AGENT_SOURCES, type AgentSource } from '@/lib/domain/types';

export const MAX_PARTICIPANTS = 5;

export interface ParticipantConfigInput {
  type: ParticipantType;
  displayName?: string;
  userId?: string;
  agentSource?: AgentSource;
  ownerUserId?: string;
}

interface BuildParticipantConfigOptions {
  host: User;
  mode: 'AGENT_VS_AGENT' | 'HUMAN_VS_AGENT';
  autoJoinSelfAgent?: boolean;
  participantCount?: number;
  participantsConfig?: ParticipantConfigInput[];
  preferredDisplayName?: string;
  alias?: string;
  realUserAgents?: ParticipantConfigInput[];
}

function clampParticipantCount(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return 2;
  }
  return Math.max(2, Math.min(MAX_PARTICIPANTS, Math.floor(value)));
}

function buildDefaultDisplayName(host: User): string {
  return host.name?.trim() || host.secondmeUserId?.trim() || 'SecondMe 玩家';
}

function buildSelfAgentName(host: User): string {
  const base = buildDefaultDisplayName(host);
  return `${base} 的 Agent`;
}

function buildPlatformAgentName(index: number): string {
  return `Platform Agent ${index}`;
}

export function normalizeAlias(alias?: string): string | undefined {
  const normalized = alias?.trim();
  return normalized ? normalized : undefined;
}

export function buildParticipantConfigs(options: BuildParticipantConfigOptions): ParticipantConfigInput[] {
  if (Array.isArray(options.participantsConfig) && options.participantsConfig.length > 0) {
    return options.participantsConfig.slice(0, MAX_PARTICIPANTS);
  }

  const hostDisplayName =
    normalizeAlias(options.alias) ??
    options.preferredDisplayName?.trim() ??
    buildDefaultDisplayName(options.host);

  if (options.mode === 'HUMAN_VS_AGENT') {
    const count = clampParticipantCount(options.participantCount);
    const participants: ParticipantConfigInput[] = [
      {
        type: ParticipantType.HUMAN,
        userId: options.host.id,
        displayName: hostDisplayName
      }
    ];

    // Add self agent if requested
    if (options.autoJoinSelfAgent) {
      participants.push({
        type: ParticipantType.AGENT,
        displayName: buildSelfAgentName(options.host),
        ownerUserId: options.host.id,
        agentSource: AGENT_SOURCES.SELF
      });
    }

    // Fill with real user agents first
    if (options.realUserAgents) {
      for (const realAgent of options.realUserAgents) {
        if (participants.length >= count) break;
        participants.push(realAgent);
      }
    }

    // Fill remaining with platform agents
    let agentIndex = 1;
    while (participants.length < count) {
      participants.push({
        type: ParticipantType.AGENT,
        displayName: buildPlatformAgentName(agentIndex),
        agentSource: AGENT_SOURCES.PLATFORM
      });
      agentIndex += 1;
    }

    return participants;
  }

  const count = clampParticipantCount(options.participantCount);
  const participants: ParticipantConfigInput[] = [
    {
      type: ParticipantType.HUMAN,
      userId: options.host.id,
      displayName: hostDisplayName
    }
  ];

  if (options.autoJoinSelfAgent) {
    participants.push({
      type: ParticipantType.AGENT,
      displayName: buildSelfAgentName(options.host),
      ownerUserId: options.host.id,
      agentSource: AGENT_SOURCES.SELF
    });
  }

  // Fill with real user agents first
  if (options.realUserAgents) {
    for (const realAgent of options.realUserAgents) {
      if (participants.length >= count) break;
      participants.push(realAgent);
    }
  }

  let agentIndex = 1;
  while (participants.length < count) {
    participants.push({
      type: ParticipantType.AGENT,
      displayName: buildPlatformAgentName(agentIndex),
      agentSource: AGENT_SOURCES.PLATFORM
    });
    agentIndex += 1;
  }

  return participants;
}

export function validateParticipantConfigs(
  configs: ParticipantConfigInput[],
  mode?: 'AGENT_VS_AGENT' | 'HUMAN_VS_AGENT'
): string | null {
  if (!Array.isArray(configs) || configs.length < 2) {
    return 'At least 2 participants required';
  }
  if (configs.length > MAX_PARTICIPANTS) {
    return `At most ${MAX_PARTICIPANTS} participants supported`;
  }

  const humanCount = configs.filter((participant) => participant.type === ParticipantType.HUMAN).length;
  const agentCount = configs.filter((participant) => participant.type === ParticipantType.AGENT).length;

  const requiresHuman = mode === 'HUMAN_VS_AGENT';

  if (requiresHuman && humanCount < 1) {
    return 'At least one human participant required';
  }
  if (agentCount < 1) {
    return 'At least one agent participant required';
  }

  return null;
}
