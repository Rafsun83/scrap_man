import { AsyncLocalStorage } from 'node:async_hooks';

/** What every log line about one request carries. */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** The request being handled (HTTP), if any; logs add its ids. */
export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  /** Called by the auth guard once the user is known. */
  setUser(userId: string): void {
    const ctx = storage.getStore();
    if (ctx) ctx.userId = userId;
  },
} as const;
