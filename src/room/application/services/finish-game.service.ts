import { Inject, Injectable } from '@nestjs/common';
import { ROOM_STORE_PORT } from '../ports/out/room-store.port';
import type { RoomStorePort } from '../ports/out/room-store.port';
import { LOBBY_LIFECYCLE_PORT } from '../ports/in/lobby-lifecycle.use-case';
import type { LobbyLifecyclePort } from '../ports/in/lobby-lifecycle.use-case';
import { REPORT_REPOSITORY_PORT } from '../ports/out/report.repository.port';
import type { ReportRepositoryPort } from '../ports/out/report.repository.port';
import { GAME_EVENTS_PORT } from '../ports/out/game-events.port';
import type { GameEventsPort } from '../ports/out/game-events.port';
import { QUESTION_RUNTIME_PORT } from '../ports/out/question-runtime.port';
import type { QuestionRuntimePort } from '../ports/out/question-runtime.port';
import type {
  FinishGamePort,
  FinishedGame,
} from '../ports/in/finish-game.use-case';
import type { StartQuestionInput } from '../ports/in/live-question.use-case';
import {
  buildGameReport,
  freezeGameReport,
  type GameReport,
} from '../../domain/game-report';
import type { Room } from '../../domain/room';
import { LobbyError } from '../../domain/lobby';

@Injectable()
export class FinishGameService implements FinishGamePort {
  private readonly pending = new Map<string, Promise<FinishedGame>>();
  constructor(
    @Inject(ROOM_STORE_PORT) private readonly rooms: RoomStorePort,
    @Inject(LOBBY_LIFECYCLE_PORT)
    private readonly lifecycle: LobbyLifecyclePort,
    @Inject(REPORT_REPOSITORY_PORT)
    private readonly reports: ReportRepositoryPort,
    @Inject(GAME_EVENTS_PORT) private readonly events: GameEventsPort,
    @Inject(QUESTION_RUNTIME_PORT)
    private readonly runtime: QuestionRuntimePort,
  ) {}
  async finish(input: StartQuestionInput): Promise<FinishedGame> {
    this.lifecycle.assertHost(input.roomId, input.ownerId, input.connectionId);
    const room = this.rooms.findById(input.roomId)!;
    const progression = [
      ...(room.previousRounds ?? []),
      ...(room.round ? [room.round] : []),
    ];
    if (
      progression.some((round) => round.commandId === input.commandId) ||
      (room.finishCommand?.commandId === input.commandId &&
        room.finishCommand.expectedRevision !== input.expectedRevision)
    )
      throw new LobbyError(
        'COMMAND_CONFLICT',
        'Command ID was used with different content',
      );
    if (room.phase === 'finished')
      return {
        roomId: room.roomId,
        revision: room.revision,
        phase: 'finished',
        report: room.report!,
      };
    if (
      room.phase !== 'question_reveal' ||
      room.round?.questionIndex !== room.quiz.questions.length - 1
    )
      throw new LobbyError(
        'WRONG_PHASE',
        'Finish requires the final question reveal',
      );
    if (
      room.finishCommand?.commandId !== input.commandId &&
      room.revision !== input.expectedRevision
    )
      throw new LobbyError('STALE_REVISION', 'Room revision has changed');
    const pending = this.pending.get(room.roomId);
    if (pending) return pending;
    this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      finishCommand:
        current.finishCommand ??
        Object.freeze({
          commandId: input.commandId,
          expectedRevision: input.expectedRevision,
        }),
    }));
    const operation = this.persist(this.rooms.findById(room.roomId)!);
    this.pending.set(room.roomId, operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(room.roomId);
    }
  }
  private async persist(room: Room): Promise<FinishedGame> {
    const candidate =
      room.reportCandidate ??
      buildGameReport(room, new Date(this.runtime.wallNow()).toISOString());
    this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      reportCandidate: candidate,
    }));
    this.lifecycle.beginFinalization(room.roomId);
    let report: GameReport;
    try {
      report = freezeGameReport(await this.reports.saveOnce(candidate));
    } catch {
      this.lifecycle.failFinalization(room.roomId);
      throw new LobbyError(
        'REPORT_SAVE_FAILED',
        'Report storage unavailable; retry host.finish with the same command',
      );
    }
    const next = this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      phase: 'finished',
      revision: current.revision + 1,
      finalizing: false,
      report,
    }));
    this.lifecycle.completeFinalization(room.roomId);
    const state: FinishedGame = {
      roomId: next.roomId,
      revision: next.revision,
      phase: 'finished',
      report,
    };
    this.events.finished(state);
    return state;
  }
}
