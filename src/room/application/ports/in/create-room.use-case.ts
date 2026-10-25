import type { RoomMetadata } from '../../../domain/room';

export const CREATE_ROOM_USE_CASE_PORT = Symbol('CREATE_ROOM_USE_CASE_PORT');

export interface CreateRoomInput {
  ownerId: string;
  quizId: string;
  requestId: string;
}

export interface CreateRoomUseCasePort {
  execute(input: CreateRoomInput): Promise<RoomMetadata>;
}
