import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.options.js';

/** Used by `pnpm db:migrate`. Reads DATABASE_URL from the environment or apps/api/.env. */
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on variables already set in the environment
}
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to apps/api/.env and export it.');
}

export default new DataSource(databaseOptions(url));
