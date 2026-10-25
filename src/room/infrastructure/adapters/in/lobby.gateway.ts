import { LobbyError } from '../../../domain/lobby';
import { joinInput, hostInput } from './lobby-input';
import { AdmissionLimiter, ADMISSION_LIMITS } from './admission-limiter';
import type { AdmissionLimits } from './admission-limiter';
import { JwtAuthGuard } from '../../../../auth/infrastructure/adapters/in/jwt-auth.guard';
import type { ValidatedToken } from '../../../../auth/application/ports/in/validate-token.use-case';
import { LobbyWsExceptionFilter } from './lobby-ws-exception.filter';
import { Inject, UseFilters, UseGuards } from '@nestjs/common';
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
import type { LobbyUseCasePort } from '../../../application/ports/in/lobby.use-case';

type LobbySocket = Omit<Socket, 'data'> & { data: { user: ValidatedToken } };

@UseFilters(LobbyWsExceptionFilter)
@UseGuards(JwtAuthGuard)
@WebSocketGateway({ maxHttpBufferSize: 8192 })
export class LobbyGateway {
  @WebSocketServer() private server: Server;
  private readonly rooms = new WeakMap<
    LobbySocket,
    { roomId: string; role: 'host' | 'guest' }
  >();
  private readonly limiter: AdmissionLimiter;
  constructor(
    @Inject(LOBBY_USE_CASE_PORT) private readonly lobby: LobbyUseCasePort,
    @Inject(ADMISSION_LIMITS) limits: AdmissionLimits,
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
    const result = this.lobby.bindHost(hostInput(payload).roomId, user.userId);
    this.rooms.set(client, { roomId: result.roomId, role: 'host' });
    await client.join(`lobby:${result.roomId}`);
    return { ok: true, data: result };
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
    this.rooms.set(client, { roomId: result.roomId, role: 'guest' });
    await client.join(`lobby:${result.roomId}`);
    this.server.to(`lobby:${result.roomId}`).emit('lobby.roster', result.state);
    return { ok: true, data: result };
  }
}
