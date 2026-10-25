import type { CreateRoomInput } from '../in/create-room.use-case';
import type { QuizSnapshot, Room } from '../../../domain/room';

export const ROOM_STORE_PORT = Symbol('ROOM_STORE_PORT');

export interface RoomStorePort {
  create(
    input: CreateRoomInput,
    loadSnapshot: () => Promise<QuizSnapshot>,
  ): Promise<Room>;
  findById(roomId: string): Room | null;
  findByPin(pin: string): Room | null;
}
