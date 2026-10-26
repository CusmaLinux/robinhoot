import type {
  PlayerQuestionState,
  QuestionEventsPort,
} from '../../../application/ports/out/question-events.port';
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
  revealed(state: QuestionState, players: PlayerQuestionState[]): void {
    const channel = `lobby:${state.roomId}`;
    this.server
      ?.to(channel)
      .except(players.map((player) => player.connectionId))
      .emit('question.revealed', state);
    for (const player of players) {
      // Intersect the lobby subscription with the socket's private room. A
      // superseded connection removed from the lobby cannot receive feedback.
      const socket = this.server?.sockets.sockets.get(player.connectionId);
      if (socket?.rooms.has(channel))
        socket.emit('question.revealed', player.state);
    }
  }
  closed(closure: LobbyClosure): void {
    const channel = `lobby:${closure.roomId}`;
    this.server?.to(channel).emit('lobby.closed', closure);
    this.server?.in(channel).socketsLeave(channel);
  }
}
