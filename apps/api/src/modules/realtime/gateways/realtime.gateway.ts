import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../../auth/services/auth.service.js';

export const userRoom = (userId: string) => `user:${userId}`;
export const ADMINS_ROOM = 'admins';

/**
 * Socket.IO on the API's own port, path /socket.io. Clients send the access token as `auth.token`.
 * Each socket joins its user's room (and admins join `admins`), then gets `ready`.
 * Clients only listen; every change goes through the HTTP API.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = client.handshake.auth as { token?: unknown } | undefined;
      const header = client.handshake.headers.authorization?.replace(/^Bearer /, '');
      const token = typeof auth?.token === 'string' ? auth.token : header;
      if (!token) throw new Error('no token');
      const user = await this.authService.authenticate(token);
      await client.join(userRoom(user.id));
      if (user.role === 'ADMIN') await client.join(ADMINS_ROOM);
      client.data.userId = user.id;
      client.emit('ready', { userId: user.id, role: user.role });
    } catch (error) {
      this.logger.debug(`Socket refused: ${String(error)}`);
      client.emit('unauthorized', { code: 'UNAUTHORIZED', message: 'Sign in again: the access token is missing or expired.' });
      client.disconnect(true);
    }
  }
}
