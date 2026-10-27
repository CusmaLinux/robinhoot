import type { LobbyLifecyclePort } from '../ports/in/lobby-lifecycle.use-case';
import { Inject, Injectable } from '@nestjs/common';
import { ROOM_STORE_PORT } from '../ports/out/room-store.port';
import type { RoomStorePort } from '../ports/out/room-store.port';
import { LOBBY_RUNTIME_PORT } from '../ports/out/lobby-runtime.port';
import type { LobbyRuntimePort } from '../ports/out/lobby-runtime.port';
import { LOBBY_EVENTS_PORT } from '../ports/out/lobby-events.port';
import type { LobbyEventsPort } from '../ports/out/lobby-events.port';
import type { Room } from '../../domain/room';
import {
  LobbyError,
  type LobbyClosure,
  type LobbyClosureReason,
} from '../../domain/lobby';

interface ActiveLobby {
  expiresAt: number;
  finishedUntil?: number;
  cancelExpiry: () => void;
  cancelQuestion?: () => void;
  connectionId: string | null;
  absence?: { at: number; cancel: () => void };
}

@Injectable()
export class LobbyLifecycleService implements LobbyLifecyclePort {
  private readonly closed = new Map<
    string,
    { ownerId: string; closure: LobbyClosure; until: number }
  >();
  private readonly active = new Map<string, ActiveLobby>();
  constructor(
    @Inject(ROOM_STORE_PORT) private readonly rooms: RoomStorePort,
    @Inject(LOBBY_RUNTIME_PORT) private readonly runtime: LobbyRuntimePort,
    @Inject(LOBBY_EVENTS_PORT) private readonly events: LobbyEventsPort,
  ) {}
  track(room: Room): void {
    if (this.active.has(room.roomId)) return;
    const expiresAt = Date.parse(room.createdAt) + 30 * 60_000;
    const entry: ActiveLobby = {
      expiresAt,
      cancelExpiry: () => {},
      connectionId: null,
    };
    this.active.set(room.roomId, entry);
    entry.cancelExpiry = this.runtime.schedule(expiresAt, () => {
      if (this.active.get(room.roomId) === entry) this.settle(room.roomId);
    });
  }
  startPlaying(roomId: string, cancelQuestion: () => void): void {
    const entry = this.active.get(roomId)!;
    entry.cancelExpiry();
    entry.expiresAt = Infinity;
    entry.cancelQuestion = cancelQuestion;
  }
  beginFinalization(roomId: string): void {
    this.rooms.mutate(roomId, (room) => ({ ...room, finalizing: true }));
    this.active.get(roomId)?.absence?.cancel();
  }
  failFinalization(roomId: string): void {
    this.rooms.mutate(roomId, (room) => ({ ...room, finalizing: false }));
    this.settle(roomId);
    const entry = this.active.get(roomId);
    if (entry?.absence) {
      entry.absence.cancel = this.runtime.schedule(entry.absence.at, () =>
        this.settle(roomId),
      );
    }
  }
  completeFinalization(roomId: string): void {
    const entry = this.active.get(roomId)!;
    entry.cancelExpiry();
    entry.cancelQuestion?.();
    entry.absence?.cancel();
    entry.absence = undefined;
    entry.finishedUntil = this.runtime.now() + 10 * 60_000;
    entry.expiresAt = Infinity;
    entry.cancelExpiry = this.runtime.schedule(entry.finishedUntil, () => {
      if (this.active.get(roomId) === entry) this.settle(roomId);
    });
  }
  private settle(roomId: string): void {
    const room = this.rooms.findById(roomId);
    if (room?.finalizing) return;
    const entry = this.active.get(roomId);
    if (!entry) return;
    if (room?.phase === 'finished') {
      if (this.runtime.now() >= entry.finishedUntil!) {
        entry.cancelExpiry();
        this.active.delete(roomId);
        this.rooms.remove(roomId);
      }
      return;
    }
    const reason = this.expirationReason(entry);
    if (reason) this.close(roomId, reason);
  }
  private expirationReason(entry: ActiveLobby): LobbyClosureReason | null {
    const deadline = Math.min(entry.expiresAt, entry.absence?.at ?? Infinity);
    if (this.runtime.now() >= deadline)
      return entry.absence && entry.absence.at < entry.expiresAt
        ? 'HOST_TIMEOUT'
        : 'LOBBY_EXPIRED';
    return null;
  }
  assertOpen(roomId: string): void {
    this.settle(roomId);
    this.prune();
    const closed = this.closed.get(roomId);
    if (closed) throw new LobbyError('ROOM_CLOSED', closed.closure.reason);
  }
  bind(roomId: string, ownerId: string, connectionId: string): string | null {
    this.owned(roomId, ownerId);
    this.assertOpen(roomId);
    const entry = this.active.get(roomId)!;
    const previous = entry.connectionId;
    entry.absence?.cancel();
    entry.absence = undefined;
    entry.connectionId = connectionId;
    return previous;
  }
  assertHost(roomId: string, ownerId: string, connectionId: string): void {
    this.owned(roomId, ownerId);
    this.assertOpen(roomId);
    if (this.active.get(roomId)?.connectionId !== connectionId)
      throw new LobbyError(
        'SESSION_REPLACED',
        'Connection no longer controls this host',
      );
  }
  disconnect(roomId: string, connectionId: string): void {
    const entry = this.active.get(roomId);
    if (!entry || entry.connectionId !== connectionId) return;
    if (this.rooms.findById(roomId)?.phase === 'finished') {
      entry.connectionId = null;
      return;
    }
    entry.connectionId = null;
    const absence = { at: this.runtime.now() + 120_000, cancel: () => {} };
    entry.absence = absence;
    absence.cancel = this.runtime.schedule(absence.at, () => {
      if (this.active.get(roomId) === entry && entry.absence === absence)
        this.settle(roomId);
    });
  }
  private owned(roomId: string, ownerId: string): void {
    this.settle(roomId);
    this.prune();
    const owner =
      this.rooms.findById(roomId)?.host.ownerId ??
      this.closed.get(roomId)?.ownerId;
    if (!owner || owner !== ownerId)
      throw new LobbyError('FORBIDDEN', 'Room is not owned by this account');
  }
  private prune(): void {
    for (const [id, value] of this.closed) {
      if (value.until <= this.runtime.now()) this.closed.delete(id);
    }
  }
  cancel(roomId: string, ownerId: string, connectionId?: string): LobbyClosure {
    this.owned(roomId, ownerId);
    this.settle(roomId);
    const previous = this.closed.get(roomId);
    if (previous) return { ...previous.closure };
    if (connectionId) this.assertHost(roomId, ownerId, connectionId);
    const room = this.rooms.findById(roomId);
    if (room?.finalizing)
      throw new LobbyError(
        'FINALIZATION_IN_PROGRESS',
        'Finalization is in progress',
      );
    if (room?.phase === 'finished')
      throw new LobbyError('WRONG_PHASE', 'Game is already finished');
    return this.close(roomId, 'OWNER_CANCELLED')!;
  }
  private close(
    roomId: string,
    reason: LobbyClosureReason,
  ): LobbyClosure | null {
    const room = this.rooms.findById(roomId);
    if (!room) return null;
    const closure: LobbyClosure = {
      roomId,
      phase: 'closed',
      revision: room.revision + 1,
      reason,
    };
    const entry = this.active.get(roomId);
    entry?.cancelExpiry();
    entry?.cancelQuestion?.();
    entry?.absence?.cancel();
    this.active.delete(roomId);
    this.rooms.remove(roomId);
    this.prune();
    if (this.closed.size >= 1000) {
      for (const oldest of this.closed.keys()) {
        this.closed.delete(oldest);
        break;
      }
    }
    this.closed.set(roomId, {
      ownerId: room.host.ownerId,
      closure,
      until: this.runtime.now() + 5 * 60_000,
    });
    this.events.closed({ ...closure });
    return { ...closure };
  }
  onModuleDestroy(): void {
    for (const entry of this.active.values()) {
      entry.cancelExpiry();
      entry.cancelQuestion?.();
      entry.absence?.cancel();
    }
    this.active.clear();
    this.closed.clear();
  }
}
