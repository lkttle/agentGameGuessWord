import { ParticipantType, RoomStatus, type Participant } from '@prisma/client';
import { AGENT_SOURCES, type AgentSource } from '@/lib/domain/types';

const validTransitions: Record<RoomStatus, RoomStatus[]> = {
  WAITING: ['RUNNING'],
  RUNNING: ['FINISHED'],
  FINISHED: []
};

export function canTransitionRoomStatus(from: RoomStatus, to: RoomStatus): boolean {
  return validTransitions[from].includes(to);
}

export function assertRoomTransition(from: RoomStatus, to: RoomStatus): void {
  if (!canTransitionRoomStatus(from, to)) {
    throw new Error(`Invalid room transition: ${from} -> ${to}`);
  }
}

export interface RoomParticipantView {
  id: string;
  userId: string | null;
  participantType: ParticipantType;
  displayName: string;
  seatOrder: number;
  ownerUserId: string | null;
  agentSource: AgentSource | null;
  status: 'ACTIVE';
}

export function inferAgentSource(participant: Participant): AgentSource | null {
  if (participant.participantType !== ParticipantType.AGENT) {
    return null;
  }
  return participant.userId ? AGENT_SOURCES.SELF : AGENT_SOURCES.PLATFORM;
}

export function toRoomParticipantView(participant: Participant): RoomParticipantView {
  const ownerUserId = participant.userId;
  return {
    id: participant.id,
    userId: participant.userId,
    participantType: participant.participantType,
    displayName: participant.displayName,
    seatOrder: participant.seatOrder,
    ownerUserId,
    agentSource: inferAgentSource(participant),
    status: 'ACTIVE'
  };
}

export function validateRoomParticipants(
  participants: Participant[],
  maxParticipants = 4,
  requiresHuman = false
): string | null {
  if (participants.length < 2) {
    return 'At least two participants required';
  }
  if (participants.length > maxParticipants) {
    return `At most ${maxParticipants} participants supported`;
  }

  const humanCount = participants.filter((item) => item.participantType === ParticipantType.HUMAN).length;
  const agentCount = participants.filter((item) => item.participantType === ParticipantType.AGENT).length;

  if (requiresHuman && humanCount < 1) {
    return 'At least one human participant required';
  }
  if (agentCount < 1) {
    return 'At least one agent participant required';
  }

  return null;
}
