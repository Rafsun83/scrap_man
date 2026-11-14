import type { EntityManager } from 'typeorm';

/**
 * Runs SQL and returns its rows. TypeORM returns `[rows, rowCount]` for UPDATE and DELETE,
 * and plain rows for everything else; callers always get the rows.
 */
export async function rows<T>(db: Pick<EntityManager, 'query'>, sql: string, params: unknown[] = []): Promise<T[]> {
  const result: unknown = await db.query(sql, params);
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0] as T[];
  }
  return result as T[];
}

export async function one<T>(db: Pick<EntityManager, 'query'>, sql: string, params: unknown[] = []): Promise<T | null> {
  return (await rows<T>(db, sql, params))[0] ?? null;
}
