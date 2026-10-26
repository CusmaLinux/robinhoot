import { Inject, Injectable } from '@nestjs/common';
import { ROOM_STORE_PORT } from '../ports/out/room-store.port';
import type { RoomStorePort } from '../ports/out/room-store.port';
import { LOBBY_LIFECYCLE_PORT } from '../ports/in/lobby-lifecycle.use-case';
import type { LobbyLifecyclePort } from '../ports/in/lobby-lifecycle.use-case';
import { QUESTION_RUNTIME_PORT } from '../ports/out/question-runtime.port';
import type { QuestionRuntimePort } from '../ports/out/question-runtime.port';
import { QUESTION_EVENTS_PORT } from '../ports/out/question-events.port';
import type { QuestionEventsPort } from '../ports/out/question-events.port';
import type {
  LiveQuestionPort,
  StartQuestionInput,
} from '../ports/in/live-question.use-case';
import type { QuestionState } from '../../domain/live-question';
import { LobbyError } from '../../domain/lobby';
import type { Room } from '../../domain/room';

@Injectable()
export class LiveQuestionService implements LiveQuestionPort {
  private readonly timers = new Map<string, () => void>();
  constructor(
    @Inject(ROOM_STORE_PORT) private readonly rooms: RoomStorePort,
    @Inject(LOBBY_LIFECYCLE_PORT)
    private readonly lifecycle: LobbyLifecyclePort,
    @Inject(QUESTION_RUNTIME_PORT)
    private readonly runtime: QuestionRuntimePort,
    @Inject(QUESTION_EVENTS_PORT) private readonly events: QuestionEventsPort,
  ) {}
  start(input: StartQuestionInput): QuestionState {
    this.lifecycle.assertHost(input.roomId, input.ownerId, input.connectionId);
    this.close(input.roomId);
    const room = this.rooms.findById(input.roomId)!;
    if (room.round?.commandId === input.commandId) {
      if (room.round.expectedRevision !== input.expectedRevision)
        throw new LobbyError(
          'COMMAND_CONFLICT',
          'Start command was accepted with different content',
        );
      return this.project(room);
    }
    if (room.phase !== 'lobby')
      throw new LobbyError(
        'WRONG_PHASE',
        'First question can only start from the lobby',
      );
    if (!room.guests.length)
      throw new LobbyError(
        'EMPTY_LOBBY',
        'At least one joined player is required',
      );
    if (room.revision !== input.expectedRevision)
      throw new LobbyError('STALE_REVISION', 'Room revision has changed');
    const duration = room.quiz.questions[0].durationSeconds * 1000;
    const openedAt = this.runtime.wallNow();
    const next = this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      phase: 'question_open',
      revision: current.revision + 1,
      round: Object.freeze({
        commandId: input.commandId,
        expectedRevision: input.expectedRevision,
        questionIndex: 0,
        eligiblePlayerIds: Object.freeze(current.guests.map((g) => g.playerId)),
        openedAt,
        deadline: openedAt + duration,
        monotonicDeadline: this.runtime.now() + duration,
      }),
    }));
    const cancel = this.runtime.schedule(next.round!.monotonicDeadline, () =>
      this.close(next.roomId),
    );
    this.timers.set(next.roomId, cancel);
    this.lifecycle.startPlaying(next.roomId, () => {
      this.timers.get(next.roomId)?.();
      this.timers.delete(next.roomId);
    });
    const state = this.project(next);
    this.events.opened(state);
    return this.project(next);
  }
  close(roomId: string): void {
    const room = this.rooms.findById(roomId);
    if (!room?.round || room.phase !== 'question_open') return;
    if (this.runtime.now() < room.round.monotonicDeadline) {
      this.timers.get(roomId)?.();
      this.timers.set(
        roomId,
        this.runtime.schedule(room.round.monotonicDeadline, () =>
          this.close(roomId),
        ),
      );
      return;
    }
    if (!this.isAvailable(roomId)) return;
    const next = this.rooms.mutate(roomId, (current) => ({
      ...current,
      phase: 'question_reveal',
      revision: current.revision + 1,
    }));
    this.timers.get(roomId)?.();
    this.timers.delete(roomId);
    this.events.revealed(this.project(next));
  }
  private isAvailable(roomId: string): boolean {
    try {
      this.lifecycle.assertOpen(roomId);
      return true;
    } catch (error) {
      // A lifecycle cutoff may cancel the room before a delayed question callback.
      if (error instanceof LobbyError && error.code === 'ROOM_CLOSED')
        return false;
      throw error;
    }
  }
  snapshot(roomId: string): QuestionState | null {
    this.close(roomId);
    const room = this.rooms.findById(roomId);
    return room?.round ? this.project(room) : null;
  }
  private project(room: Room): QuestionState {
    const round = room.round!;
    const question = room.quiz.questions[round.questionIndex];
    return {
      roomId: room.roomId,
      questionId: question.id,
      revision: room.revision,
      phase: room.phase as QuestionState['phase'],
      question: {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options.map((option, index) => ({
          id: option.id,
          label: String.fromCharCode(65 + index),
          text: option.text,
        })),
      },
      eligiblePlayerIds: [...round.eligiblePlayerIds],
      openedAt: round.openedAt,
      deadline: round.deadline,
      serverNow: this.runtime.wallNow(),
      timeUnit: 'milliseconds',
      score: 0,
      ...(room.phase === 'question_reveal'
        ? { correctOptionIds: [...question.correctOptionIds] }
        : {}),
    };
  }
  onModuleDestroy(): void {
    for (const cancel of this.timers.values()) cancel();
    this.timers.clear();
  }
}
