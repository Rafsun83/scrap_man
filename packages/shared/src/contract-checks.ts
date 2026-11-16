/**
 * Compile-time checks that hand-written runtime lists match docs/openapi.yaml.
 * `pnpm typecheck` fails here after a contract change until enums.ts is updated too.
 */
import type { components } from './generated/api.js';
import type { SOCKET_EVENTS, WORK_AREA_CODES } from './enums.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Schemas = components['schemas'];

export const workAreasMatchContract: Same<Schemas['WorkArea'], (typeof WORK_AREA_CODES)[number]> = true;
export const socketEventsMatchContract: Same<Schemas['SocketEvents'], (typeof SOCKET_EVENTS)[number]> = true;
