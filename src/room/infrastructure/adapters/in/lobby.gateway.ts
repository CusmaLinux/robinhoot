import { LIVE_QUESTION_PORT } from '../../../application/ports/in/live-question.use-case';
import type { LiveQuestionPort } from '../../../application/ports/in/live-question.use-case';
import { LOBBY_LIFECYCLE_PORT } from '../../../application/ports/in/lobby-lifecycle.use-case';
import type { LobbyLifecyclePort } from '../../../application/ports/in/lobby-lifecycle.use-case';
import { SocketLobbyEvents } from '../out/socket-lobby.events';
import { LobbyError, type LobbyState } from '../../../domain/lobby';
import {
  joinInput,
  hostInput,
  restoreInput,
  cancelInput,
  startInput,
  answerInput,
} from './lobby-input';
import { AdmissionLimiter, ADMISSION_LIMITS } from './admission-limiter';
import type { AdmissionLimits } from './admission-limiter';
import { JwtAuthGuard } from '../../../../auth/infrastructure/adapters/in/jwt-auth.guard';
import { VALIDATE_TOKEN_USE_CASE_PORT } from '../../../../auth/application/ports/in/validate-token.use-case';
import type {
  ValidatedToken,
  ValidateTokenUseCasePort,
} from '../../../../auth/application/ports/in/validate-token.use-case';
import { LobbyWsExceptionFilter } from './lobby-ws-exception.filter';
import {
  Inject,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Public } from '../../../../auth/infrastructure/adapters/in/public.decorator';
import { LOBBY_USE_CASE_PORT } from '../../../application/ports/in/lobby.use-case';
import type {
  Admission,
  LobbyUseCasePort,
} from '../../../application/ports/in/lobby.use-case';

type LobbySocket = Omit<Socket, 'data'> & { data: { user: ValidatedToken } };

@UseFilters(LobbyWsExceptionFilter)
@UseGuards(JwtAuthGuard)
@WebSocketGateway({ maxHttpBufferSize: 8192 })
export class LobbyGateway {
  @WebSocketServer() private server: Server;
  private readonly rooms = new WeakMap<
    LobbySocket,
    { roomId: string; role: 'host' | 'guest'; playerId?: string }
  >();
  private readonly limiter: AdmissionLimiter;
  constructor(
    @Inject(LOBBY_USE_CASE_PORT) private readonly lobby: LobbyUseCasePort,
    @Inject(ADMISSION_LIMITS) limits: AdmissionLimits,
    @Inject(VALIDATE_TOKEN_USE_CASE_PORT)
    private readonly validateToken: ValidateTokenUseCasePort,
    @Inject(LOBBY_LIFECYCLE_PORT)
    private readonly lifecycle: LobbyLifecyclePort,
    private readonly events: SocketLobbyEvents,
    @Inject(LIVE_QUESTION_PORT) private readonly live: LiveQuestionPort,
  ) {
    this.limiter = new AdmissionLimiter(limits);
  }

  afterInit(server: Server) {
    this.events.attach(server);
  }

  handleDisconnect(client: LobbySocket) {
    this.limiter.release(client.id);
    const roomId = this.rooms.get(client)?.roomId;
    if (roomId) {
      this.lifecycle.disconnect(roomId, client.id);
      const state = this.lobby.disconnect(roomId, client.id);
      if (state) this.server.to(`lobby:${roomId}`).emit('lobby.roster', state);
    }
    this.rooms.delete(client);
  }

  @SubscribeMessage('host.bind')
  async bind(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    const bound = this.rooms.get(client);
    if (
      bound &&
      (bound.role !== 'host' || bound.roomId !== hostInput(payload).roomId)
    )
      throw new LobbyError(
        'SESSION_ALREADY_BOUND',
        'Connection is already bound to a lobby actor',
      );
    const user = client.data.user;
    const roomId = hostInput(payload).roomId;
    this.lobby.bindHost(roomId, user.userId);
    const previous = this.lifecycle.bind(roomId, user.userId, client.id);
    this.rooms.set(client, { roomId, role: 'host' });
    if (previous && previous !== client.id)
      await this.server.sockets.sockets.get(previous)?.leave(`lobby:${roomId}`);
    const current = await this.subscribeSnapshot(client, roomId, () => {
      this.lifecycle.assertHost(roomId, user.userId, client.id);
      return this.lobby.bindHost(roomId, user.userId);
    });
    return { ok: true, data: current };
  }

  @SubscribeMessage('host.start')
  start(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    const input = startInput(payload);
    const bound = this.rooms.get(client);
    if (!bound || bound.role !== 'host' || bound.roomId !== input.roomId)
      throw new LobbyError('FORBIDDEN', 'Connection is not bound as this host');
    return {
      ok: true,
      data: this.live.start({
        ...input,
        ownerId: client.data.user.userId,
        connectionId: client.id,
      }),
    };
  }

  @Public()
  @SubscribeMessage('answer.submit')
  submit(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    const input = answerInput(payload);
    const bound = this.rooms.get(client);
    if (!bound || bound.role !== 'guest' || bound.roomId !== input.roomId)
      throw new LobbyError(
        'FORBIDDEN',
        'Connection is not bound as this room guest',
      );
    return {
      ok: true,
      data: this.live.submit({ ...input, connectionId: client.id }),
    };
  }

  @SubscribeMessage('host.cancel')
  cancel(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    const { roomId } = cancelInput(payload);
    const bound = this.rooms.get(client);
    if (!bound || bound.role !== 'host' || bound.roomId !== roomId)
      throw new LobbyError('FORBIDDEN', 'Connection is not bound as this host');
    return {
      ok: true,
      data: this.lifecycle.cancel(roomId, client.data.user.userId, client.id),
    };
  }

  @Public()
  @SubscribeMessage('lobby.join')
  async join(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    this.limiter.check(client.id, client.handshake.address);
    const bound = this.rooms.get(client);
    if (bound && bound.role !== 'guest')
      throw new LobbyError(
        'SESSION_ALREADY_BOUND',
        'Connection is already bound to a lobby actor',
      );
    const input = joinInput(payload);
    const result = this.lobby.join({
      ...input,
      connectionId: client.id,
      boundRoomId: bound?.roomId,
    });
    this.rooms.set(client, {
      roomId: result.roomId,
      role: 'guest',
      playerId: result.playerId,
    });
    return this.publishGuest(client, result);
  }

  @Public()
  @SubscribeMessage('session.restore')
  async restore(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    this.limiter.check(client.id, client.handshake.address);
    const input = restoreInput(payload);
    const bound = this.rooms.get(client);
    if (bound?.role === 'host')
      throw new LobbyError(
        'SESSION_ALREADY_BOUND',
        'Connection is already bound to a lobby actor',
      );
    const { previousConnectionId, ...result } = this.lobby.restore({
      ...input,
      connectionId: client.id,
      boundRoomId: bound?.roomId,
      boundPlayerId: bound?.playerId,
    });
    this.rooms.set(client, {
      roomId: result.roomId,
      role: 'guest',
      playerId: result.playerId,
    });
    if (previousConnectionId && previousConnectionId !== client.id)
      await this.server.sockets.sockets
        .get(previousConnectionId)
        ?.leave(`lobby:${result.roomId}`);
    return this.publishGuest(client, result);
  }

  @Public()
  @SubscribeMessage('state.sync')
  async sync(
    @ConnectedSocket() client: LobbySocket,
    @MessageBody() payload: unknown,
  ) {
    const { roomId } = hostInput(payload);
    const bound = this.rooms.get(client);
    if (!bound || bound.roomId !== roomId)
      throw new LobbyError('FORBIDDEN', 'Connection is not bound to this room');
    let ownerId: string | undefined;
    if (bound.role === 'host') {
      const token: unknown = client.handshake.auth.token;
      if (typeof token !== 'string' || !token)
        throw new UnauthorizedException();
      ownerId = (await this.validateToken.execute(token)).userId;
    }
    const read = () => {
      if (ownerId) this.lifecycle.assertHost(roomId, ownerId, client.id);
      return ownerId
        ? this.lobby.bindHost(roomId, ownerId)
        : this.lobby.syncGuest(roomId, client.id);
    };
    read();
    const current = await this.subscribeSnapshot(client, roomId, read);
    return { ok: true, data: current };
  }

  private async publishGuest(client: LobbySocket, result: Admission) {
    result.state = await this.subscribeSnapshot(client, result.roomId, () =>
      this.lobby.syncGuest(result.roomId, client.id),
    );
    const { roomId, revision, phase, roster } = result.state;
    this.server
      .to(`lobby:${roomId}`)
      .emit('lobby.roster', { roomId, revision, phase, roster });
    return { ok: true, data: result };
  }

  private async subscribeSnapshot(
    client: LobbySocket,
    roomId: string,
    read: () => LobbyState,
  ): Promise<LobbyState> {
    const channel = `lobby:${roomId}`;
    await client.join(channel);
    try {
      if (!client.connected)
        throw new LobbyError(
          'SESSION_REPLACED',
          'Connection is no longer active',
        );
      // The adapter subscription is complete before this synchronous authority check
      // and snapshot. Mutations during join are in the snapshot; later ones are events.
      const state = read();
      const bound = this.rooms.get(client);
      return {
        ...state,
        ...(this.live.snapshot(
          roomId,
          bound?.role === 'guest' ? client.id : undefined,
        ) ?? {}),
      };
    } catch (error) {
      await client.leave(channel);
      throw error;
    }
  }
}
