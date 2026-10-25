import {
  ADMISSION_LIMITS,
  DEFAULT_ADMISSION_LIMITS,
} from './adapters/in/admission-limiter';
import { LobbyGateway } from './adapters/in/lobby.gateway';
import { LobbyService } from '../application/services/lobby.service';
import { LOBBY_USE_CASE_PORT } from '../application/ports/in/lobby.use-case';
import { GUEST_CREDENTIAL_ISSUER_PORT } from '../application/ports/out/guest-credential-issuer.port';
import { RandomGuestCredentialIssuer } from './adapters/out/random-guest-credential.issuer';
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
    LobbyGateway,
    { provide: ADMISSION_LIMITS, useValue: DEFAULT_ADMISSION_LIMITS },
    { provide: LOBBY_USE_CASE_PORT, useClass: LobbyService },
    {
      provide: GUEST_CREDENTIAL_ISSUER_PORT,
      useClass: RandomGuestCredentialIssuer,
    },
    { provide: CREATE_ROOM_USE_CASE_PORT, useClass: CreateRoomService },
    { provide: ROOM_STORE_PORT, useFactory: () => new InMemoryRoomStore() },
    { provide: QUIZ_SNAPSHOT_READER_PORT, useClass: OwnedQuizSnapshotReader },
  ],
})
export class RoomModule {}
