/** API base URL including /api/v1. The phone must reach your computer, so use its LAN IP in .env. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';

/** Socket.IO connects to the API origin (path /socket.io), not to /api/v1. */
export const SOCKET_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

/** BhangariWala support line for collectors (C7, C3, C11). Set EXPO_PUBLIC_SUPPORT_PHONE; the call buttons hide without it. */
export const SUPPORT_PHONE = process.env.EXPO_PUBLIC_SUPPORT_PHONE?.trim() || null;
