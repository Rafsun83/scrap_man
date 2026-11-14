import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/** One place for connection settings, used by the app and by the migration CLI. */
export function databaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    migrations: [join(import.meta.dirname, 'migrations', '*.{js,ts}')],
    migrationsTableName: 'typeorm_migrations',
  };
}
