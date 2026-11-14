import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Turns on PostGIS for location queries and pgcrypto for gen_random_uuid(). */
export class InitExtensions1763020800000 implements MigrationInterface {
  name = 'InitExtensions1763020800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS pgcrypto');
    await queryRunner.query('DROP EXTENSION IF EXISTS postgis');
  }
}
