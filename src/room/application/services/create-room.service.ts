import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateRoomInput,
  CreateRoomUseCasePort,
} from '../ports/in/create-room.use-case';
import { QUIZ_SNAPSHOT_READER_PORT } from '../ports/out/quiz-snapshot-reader.port';
import type { QuizSnapshotReaderPort } from '../ports/out/quiz-snapshot-reader.port';
import { ROOM_STORE_PORT } from '../ports/out/room-store.port';
import type { RoomStorePort } from '../ports/out/room-store.port';
import { roomMetadata } from '../../domain/room';

@Injectable()
export class CreateRoomService implements CreateRoomUseCasePort {
  constructor(
    @Inject(ROOM_STORE_PORT) private readonly rooms: RoomStorePort,
    @Inject(QUIZ_SNAPSHOT_READER_PORT)
    private readonly quizzes: QuizSnapshotReaderPort,
  ) {}

  async execute(input: CreateRoomInput) {
    const room = await this.rooms.create(input, () =>
      this.quizzes.readOwned(input.ownerId, input.quizId),
    );
    return roomMetadata(room);
  }
}
