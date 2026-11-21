import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the extensions that the postgis/postgis Docker image turns on by itself: the US-only TIGER geocoder
 * (schemas `tiger`, `tiger_data`), its helper fuzzystrmatch, and PostGIS topology (schema `topology`). The app uses
 * none of them, and managed Postgres in production will not have them, so local databases now match production.
 * IF EXISTS keeps this a no-op where they were never installed.
 */
export class DropTigerExtensions1763625600000 implements MigrationInterface {
  name = 'DropTigerExtensions1763625600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE');
    await queryRunner.query('DROP EXTENSION IF EXISTS postgis_topology CASCADE');
    await queryRunner.query('DROP EXTENSION IF EXISTS fuzzystrmatch');
    await queryRunner.query('DROP SCHEMA IF EXISTS tiger_data CASCADE');
    await queryRunner.query('DROP SCHEMA IF EXISTS tiger CASCADE');
    await queryRunner.query('DROP SCHEMA IF EXISTS topology CASCADE');
  }

  public async down(): Promise<void> {
    // Nothing to restore: these extensions came from the Docker image, not from a migration, and recreating them
    // would fail on hosts that do not offer them.
  }
}
