import { Injectable } from '@nestjs/common';
import type { SocketEvent } from '@bw/shared';
import { ADMINS_ROOM, RealtimeGateway, userRoom } from './realtime.gateway.js';

/** Sends live events to users' rooms. Delivery is best effort; apps refetch on reconnect. */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  /** To these users, and to admins when `admins` is true. A socket in several rooms gets it once. */
  emit(event: SocketEvent, payload: unknown, userIds: (string | null | undefined)[], admins = true): void {
    const server = this.gateway.server;
    if (!server) return;
    const rooms = [...new Set(userIds.filter((id): id is string => !!id))].map(userRoom);
    if (admins) rooms.push(ADMINS_ROOM);
    if (rooms.length > 0) server.to(rooms).emit(event, payload);
  }

  /** One payload per user (e.g. each collector's own distance), not copied to admins. */
  emitEach(event: SocketEvent, items: { userId: string; payload: unknown }[]): void {
    const server = this.gateway.server;
    if (!server) return;
    for (const { userId, payload } of items) server.to(userRoom(userId)).emit(event, payload);
  }
}
