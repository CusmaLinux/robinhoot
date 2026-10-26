import { randomInt, randomUUID } from 'crypto';
import type { RoomStorePort } from '../../../application/ports/out/room-store.port';
import type { CreateRoomInput } from '../../../application/ports/in/create-room.use-case';
import type { QuizSnapshot, Room } from '../../../domain/room';
import { freezeSnapshot } from '../../../domain/room';
import {
  ActiveRoomError,
  CreationRequestConflictError,
  PinAllocationError,
} from '../../../domain/room.errors';

export class InMemoryRoomStore implements RoomStorePort {
  private readonly rooms = new Map<string, Room>();
  private readonly owners = new Map<string, Room>();
  private readonly pins = new Map<string, Room>();
  private readonly pending = new Map<string, Promise<Room>>();

  constructor(
    private readonly generatePin = () =>
      randomInt(1_000_000).toString().padStart(6, '0'),
    private readonly now = () => Date.now(),
  ) {}

  async create(
    input: CreateRoomInput,
    loadSnapshot: () => Promise<QuizSnapshot>,
  ): Promise<Room> {
    while (this.pending.has(input.ownerId)) {
      await this.pending.get(input.ownerId)!.catch(() => undefined);
    }
    const creation = this.createOwned(input, loadSnapshot);
    this.pending.set(input.ownerId, creation);
    try {
      return await creation;
    } finally {
      this.pending.delete(input.ownerId);
    }
  }

  private async createOwned(
    input: CreateRoomInput,
    loadSnapshot: () => Promise<QuizSnapshot>,
  ): Promise<Room> {
    const existing = this.owners.get(input.ownerId);
    if (existing) {
      if (existing.creationRequestId === input.requestId) {
        if (existing.quiz.sourceQuizId !== input.quizId)
          throw new CreationRequestConflictError();
        return existing;
      }
      throw new ActiveRoomError();
    }
    const quiz = freezeSnapshot(await loadSnapshot());
    const room: Room = Object.freeze({
      roomId: randomUUID(),
      pin: this.allocatePin(),
      phase: 'lobby',
      guests: Object.freeze([]),
      revision: 0,
      createdAt: new Date(this.now()).toISOString(),
      host: Object.freeze({ ownerId: input.ownerId }),
      creationRequestId: input.requestId,
      quiz,
    });
    this.rooms.set(room.roomId, room);
    this.owners.set(input.ownerId, room);
    this.pins.set(room.pin, room);
    return room;
  }

  remove(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.rooms.delete(roomId);
    this.owners.delete(room.host.ownerId);
    this.pins.delete(room.pin);
  }

  mutate(roomId: string, change: (room: Room) => Room): Room {
    const current = this.rooms.get(roomId);
    if (!current) throw new Error('Unknown internal room');
    // Synchronous mutations cannot interleave within this single-process adapter.
    const next = Object.freeze(change(current));
    this.rooms.set(roomId, next);
    this.owners.set(next.host.ownerId, next);
    this.pins.set(next.pin, next);
    return next;
  }

  findById(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  findByPin(pin: string): Room | null {
    return this.pins.get(pin) ?? null;
  }

  private allocatePin(): string {
    for (let attempt = 0; attempt < 32; attempt++) {
      const pin = this.generatePin();
      if (!this.pins.has(pin)) return pin;
    }
    throw new PinAllocationError();
  }
}
