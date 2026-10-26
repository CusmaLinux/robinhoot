import type { Server } from 'socket.io';
import type { LobbyEventsPort } from '../../../application/ports/out/lobby-events.port';
import type { LobbyClosure } from '../../../domain/lobby';

export class SocketLobbyEvents implements LobbyEventsPort {
  private server?: Server;
  attach(server: Server): void {
    this.server = server;
  }
  closed(closure: LobbyClosure): void {
    const channel = `lobby:${closure.roomId}`;
    this.server?.to(channel).emit('lobby.closed', closure);
    this.server?.in(channel).socketsLeave(channel);
  }
}
