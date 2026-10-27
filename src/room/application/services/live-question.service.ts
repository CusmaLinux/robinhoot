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
  SubmitAnswerInput,
} from '../ports/in/live-question.use-case';
import type { AnswerReceipt, QuestionState } from '../../domain/live-question';
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
    const room = this.commandRoom(input);
    if (this.acceptedCommand(room, input, 'start')) return this.project(room);
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
    return this.open(room, input, 0);
  }
  next(input: StartQuestionInput): QuestionState {
    const room = this.commandRoom(input);
    if (this.acceptedCommand(room, input, 'next')) return this.project(room);
    if (room.phase !== 'question_reveal')
      throw new LobbyError('WRONG_PHASE', 'Next requires a revealed question');
    const index = room.round!.questionIndex + 1;
    if (index >= room.quiz.questions.length)
      throw new LobbyError(
        'NO_MORE_QUESTIONS',
        'The final question is already revealed',
      );
    if (room.revision !== input.expectedRevision)
      throw new LobbyError('STALE_REVISION', 'Room revision has changed');
    return this.open(room, input, index);
  }
  private commandRoom(input: StartQuestionInput): Room {
    this.lifecycle.assertHost(input.roomId, input.ownerId, input.connectionId);
    this.close(input.roomId);
    return this.rooms.findById(input.roomId)!;
  }
  private acceptedCommand(
    room: Room,
    input: StartQuestionInput,
    kind: 'start' | 'next',
  ): boolean {
    const accepted = [
      ...(room.previousRounds ?? []),
      ...(room.round ? [room.round] : []),
    ].find((round) => round.commandId === input.commandId);
    if (!accepted) return false;
    if (
      accepted.expectedRevision !== input.expectedRevision ||
      (accepted.questionIndex === 0 ? 'start' : 'next') !== kind
    )
      throw new LobbyError(
        'COMMAND_CONFLICT',
        kind === 'start'
          ? 'Start command was accepted with different content'
          : 'Next command was accepted with different content',
      );
    return true;
  }
  private open(
    room: Room,
    input: StartQuestionInput,
    questionIndex: number,
  ): QuestionState {
    const duration = room.quiz.questions[questionIndex].durationSeconds * 1000;
    const openedAt = this.runtime.wallNow();
    const next = this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      previousRounds: Object.freeze([
        ...(current.previousRounds ?? []),
        ...(current.round ? [current.round] : []),
      ]),
      phase: 'question_open',
      revision: current.revision + 1,
      round: Object.freeze({
        scores: Object.freeze([]),
        answers: Object.freeze([]),
        commandId: input.commandId,
        expectedRevision: input.expectedRevision,
        questionIndex,
        eligiblePlayerIds:
          current.round?.eligiblePlayerIds ??
          Object.freeze(current.guests.map((g) => g.playerId)),
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
  submit(input: SubmitAnswerInput): AnswerReceipt {
    this.lifecycle.assertOpen(input.roomId);
    const room = this.rooms.findById(input.roomId)!;
    const guest = room.guests.find(
      (g) => g.connectionId === input.connectionId,
    );
    if (!guest)
      throw new LobbyError(
        'SESSION_REPLACED',
        'Connection no longer owns this guest session',
      );
    const round =
      [
        ...(room.previousRounds ?? []),
        ...(room.round ? [room.round] : []),
      ].find(
        (played) =>
          room.quiz.questions[played.questionIndex].id === input.questionId,
      ) ?? room.round;
    if (!round) throw new LobbyError('WRONG_PHASE', 'No question is open');
    const question = room.quiz.questions[round.questionIndex];
    if (question.id !== input.questionId)
      throw new LobbyError(
        'WRONG_QUESTION',
        'Answer must target the current question',
      );
    if (!question.options.some((o) => o.id === input.optionId))
      throw new LobbyError(
        'INVALID_OPTION',
        'Option does not belong to this question',
      );
    if (!round.eligiblePlayerIds.includes(guest.playerId))
      throw new LobbyError(
        'FORBIDDEN',
        'Player is not eligible for this question',
      );
    const accepted = round.answers.find((a) => a.playerId === guest.playerId);
    if (
      accepted?.receipt.submissionId === input.submissionId &&
      accepted.receipt.optionId === input.optionId
    )
      return { ...accepted.receipt };
    if (accepted?.receipt.submissionId === input.submissionId)
      throw new LobbyError(
        'SUBMISSION_CONFLICT',
        'Submission ID was accepted with different content',
      );
    if (accepted)
      throw new LobbyError(
        'ALREADY_ANSWERED',
        'Player already answered this question',
      );
    if (round !== room.round)
      throw new LobbyError(
        'WRONG_QUESTION',
        'Answer must target the current question',
      );
    if (this.runtime.now() >= round.monotonicDeadline)
      throw new LobbyError('LATE_ANSWER', 'Question deadline has passed');
    if (room.phase !== 'question_open')
      throw new LobbyError('WRONG_PHASE', 'Question is not open');
    const receipt: AnswerReceipt = Object.freeze({
      roomId: room.roomId,
      questionId: question.id,
      submissionId: input.submissionId,
      optionId: input.optionId,
      accepted: true,
      acceptedAt: this.runtime.wallNow(),
      revision: room.revision + 1,
    });
    this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      revision: receipt.revision,
      round: Object.freeze({
        ...round,
        answers: Object.freeze([
          ...round.answers,
          Object.freeze({ playerId: guest.playerId, receipt }),
        ]),
      }),
    }));
    return { ...receipt };
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
      round: Object.freeze({
        ...current.round!,
        scores: Object.freeze(
          current.round!.eligiblePlayerIds.map((playerId) =>
            Object.freeze({
              playerId,
              points: current.round!.answers.some(
                (a) =>
                  a.playerId === playerId &&
                  current.quiz.questions[
                    current.round!.questionIndex
                  ].correctOptionIds.includes(a.receipt.optionId),
              )
                ? 1000
                : 0,
            }),
          ),
        ),
      }),
      phase: 'question_reveal',
      revision: current.revision + 1,
    }));
    this.timers.get(roomId)?.();
    this.timers.delete(roomId);
    this.events.revealed(
      this.project(next),
      next.guests.flatMap((guest) =>
        guest.connectionId
          ? [
              {
                connectionId: guest.connectionId,
                state: this.project(next, guest.connectionId),
              },
            ]
          : [],
      ),
    );
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
  snapshot(roomId: string, connectionId?: string): QuestionState | null {
    this.close(roomId);
    // Public host projections must settle lifecycle deadlines too, including at reveal.
    this.lifecycle.assertOpen(roomId);
    const room = this.rooms.findById(roomId);
    if (connectionId) {
      if (!room?.guests.some((g) => g.connectionId === connectionId))
        throw new LobbyError(
          'SESSION_REPLACED',
          'Connection no longer owns this guest session',
        );
    }
    return room?.round ? this.project(room, connectionId) : null;
  }
  private project(room: Room, connectionId?: string): QuestionState {
    const playerId = room.guests.find(
      (g) => g.connectionId === connectionId,
    )?.playerId;
    const round = room.round!;
    const question = room.quiz.questions[round.questionIndex];
    const accepted = round.answers.find(
      (answer) => answer.playerId === playerId,
    );
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
      ...(playerId
        ? { acceptedAnswer: accepted ? { ...accepted.receipt } : null }
        : {}),
      score: [...(room.previousRounds ?? []), round].reduce(
        (total, played) =>
          total +
          (played.scores.find((s) => s.playerId === playerId)?.points ?? 0),
        0,
      ),
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
