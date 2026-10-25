import { Module } from '@nestjs/common';
import { QuizModule } from '../../quiz/infrastructure/quiz.module';
import { CREATE_ROOM_USE_CASE_PORT } from '../application/ports/in/create-room.use-case';
import { ROOM_STORE_PORT } from '../application/ports/out/room-store.port';
import { QUIZ_SNAPSHOT_READER_PORT } from '../application/ports/out/quiz-snapshot-reader.port';
import { CreateRoomService } from '../application/services/create-room.service';
import { RoomController } from './adapters/in/room.controller';
import { InMemoryRoomStore } from './adapters/out/in-memory-room.store';
import { OwnedQuizSnapshotReader } from './adapters/out/owned-quiz-snapshot.reader';

@Module({
  imports: [QuizModule],
  controllers: [RoomController],
  providers: [
    { provide: CREATE_ROOM_USE_CASE_PORT, useClass: CreateRoomService },
    { provide: ROOM_STORE_PORT, useFactory: () => new InMemoryRoomStore() },
    { provide: QUIZ_SNAPSHOT_READER_PORT, useClass: OwnedQuizSnapshotReader },
  ],
})
export class RoomModule {}
