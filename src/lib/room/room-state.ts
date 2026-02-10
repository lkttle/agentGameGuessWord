import { RoomStatus } from '@prisma/client';

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
