import { LobbyError, type LobbyState } from '../../../domain/lobby';
import { joinInput, hostInput, restoreInput } from './lobby-input';
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
  ) {
    this.limiter = new AdmissionLimiter(limits);
  }

  handleDisconnect(client: LobbySocket) {
    this.limiter.release(client.id);
    const roomId = this.rooms.get(client)?.roomId;
    if (roomId) {
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
    this.rooms.set(client, { roomId, role: 'host' });
    const current = await this.subscribeSnapshot(client, roomId, () =>
      this.lobby.bindHost(roomId, user.userId),
    );
    return { ok: true, data: current };
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
    const read = () =>
      ownerId
        ? this.lobby.bindHost(roomId, ownerId)
        : this.lobby.syncGuest(roomId, client.id);
    read();
    const current = await this.subscribeSnapshot(client, roomId, read);
    return { ok: true, data: current };
  }

  private async publishGuest(client: LobbySocket, result: Admission) {
    result.state = await this.subscribeSnapshot(client, result.roomId, () =>
      this.lobby.syncGuest(result.roomId, client.id),
    );
    this.server.to(`lobby:${result.roomId}`).emit('lobby.roster', result.state);
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
      return read();
    } catch (error) {
      await client.leave(channel);
      throw error;
    }
  }
}
