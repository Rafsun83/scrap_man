import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/database/database.options.js';
import { CATEGORIES } from '../src/database/seed-data.js';

/** Brings the test database up to the latest migration and loads the categories once. */
export default async function setup() {
  const ds = new DataSource(databaseOptions(process.env.DATABASE_URL!));
  await ds.initialize();
  try {
    await ds.runMigrations();
    for (const [i, c] of CATEGORIES.entries()) {
      await ds.query(
        `INSERT INTO categories (code, name_bn, name_en, pricing_type, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.nameBn, c.nameEn, c.pricingType, c.icon, i],
      );
    }
  } finally {
    await ds.destroy();
  }
}
