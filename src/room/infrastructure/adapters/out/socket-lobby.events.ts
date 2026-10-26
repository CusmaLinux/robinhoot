import type { QuestionEventsPort } from '../../../application/ports/out/question-events.port';
import type { QuestionState } from '../../../domain/live-question';
import type { Server } from 'socket.io';
import type { LobbyEventsPort } from '../../../application/ports/out/lobby-events.port';
import type { LobbyClosure } from '../../../domain/lobby';

export class SocketLobbyEvents implements LobbyEventsPort, QuestionEventsPort {
  private server?: Server;
  attach(server: Server): void {
    this.server = server;
  }
  opened(state: QuestionState): void {
    this.server?.to(`lobby:${state.roomId}`).emit('question.opened', state);
  }
  revealed(state: QuestionState): void {
    this.server?.to(`lobby:${state.roomId}`).emit('question.revealed', state);
  }
  closed(closure: LobbyClosure): void {
    const channel = `lobby:${closure.roomId}`;
    this.server?.to(channel).emit('lobby.closed', closure);
    this.server?.in(channel).socketsLeave(channel);
  }
}
