import { READ_REPORTS_PORT } from '../application/ports/in/read-reports.use-case';
import { REPORT_HISTORY_PORT } from '../application/ports/out/report-history.port';
import { ReadReportsService } from '../application/services/read-reports.service';
import { ReportController } from './adapters/in/report.controller';
import { FINISH_GAME_PORT } from '../application/ports/in/finish-game.use-case';
import { GAME_EVENTS_PORT } from '../application/ports/out/game-events.port';
import { REPORT_REPOSITORY_PORT } from '../application/ports/out/report.repository.port';
import { FinishGameService } from '../application/services/finish-game.service';
import { ReportKyselyAdapter } from './adapters/out/report.kysely.adapter';
import { LIVE_QUESTION_PORT } from '../application/ports/in/live-question.use-case';
import { QUESTION_RUNTIME_PORT } from '../application/ports/out/question-runtime.port';
import { QUESTION_EVENTS_PORT } from '../application/ports/out/question-events.port';
import { LiveQuestionService } from '../application/services/live-question.service';
import { SystemQuestionRuntime } from './adapters/out/system-question.runtime';
import type { LobbyRuntimePort } from '../application/ports/out/lobby-runtime.port';
import { LobbyLifecycleService } from '../application/services/lobby-lifecycle.service';
import { LOBBY_LIFECYCLE_PORT } from '../application/ports/in/lobby-lifecycle.use-case';
import { LOBBY_RUNTIME_PORT } from '../application/ports/out/lobby-runtime.port';
import { LOBBY_EVENTS_PORT } from '../application/ports/out/lobby-events.port';
import { SystemLobbyRuntime } from './adapters/out/system-lobby.runtime';
import { SocketLobbyEvents } from './adapters/out/socket-lobby.events';
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
  controllers: [RoomController, ReportController],
  providers: [
    LobbyGateway,
    { provide: READ_REPORTS_PORT, useClass: ReadReportsService },
    { provide: REPORT_HISTORY_PORT, useExisting: REPORT_REPOSITORY_PORT },
    { provide: FINISH_GAME_PORT, useClass: FinishGameService },
    { provide: GAME_EVENTS_PORT, useExisting: SocketLobbyEvents },
    { provide: REPORT_REPOSITORY_PORT, useClass: ReportKyselyAdapter },
    { provide: LIVE_QUESTION_PORT, useClass: LiveQuestionService },
    { provide: QUESTION_RUNTIME_PORT, useClass: SystemQuestionRuntime },
    { provide: QUESTION_EVENTS_PORT, useExisting: SocketLobbyEvents },
    { provide: LOBBY_LIFECYCLE_PORT, useClass: LobbyLifecycleService },
    { provide: LOBBY_RUNTIME_PORT, useClass: SystemLobbyRuntime },
    SocketLobbyEvents,
    { provide: LOBBY_EVENTS_PORT, useExisting: SocketLobbyEvents },
    { provide: ADMISSION_LIMITS, useValue: DEFAULT_ADMISSION_LIMITS },
    { provide: LOBBY_USE_CASE_PORT, useClass: LobbyService },
    {
      provide: GUEST_CREDENTIAL_ISSUER_PORT,
      useClass: RandomGuestCredentialIssuer,
    },
    { provide: CREATE_ROOM_USE_CASE_PORT, useClass: CreateRoomService },
    {
      provide: ROOM_STORE_PORT,
      inject: [LOBBY_RUNTIME_PORT],
      useFactory: (runtime: LobbyRuntimePort) =>
        new InMemoryRoomStore(undefined, () => runtime.now()),
    },
    { provide: QUIZ_SNAPSHOT_READER_PORT, useClass: OwnedQuizSnapshotReader },
  ],
})
export class RoomModule {}
