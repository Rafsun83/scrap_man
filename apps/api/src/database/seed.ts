import 'reflect-metadata';
import dataSource from './data-source.js';
import { dhakaToday } from '../common/time.js';
import { CATEGORIES, SAMPLE_RATES } from './seed-data.js';

/**
 * `pnpm db:seed` loads the categories and, if ADMIN_PHONE is set, the first admin account.
 * `pnpm db:seed -- --sample-rates` also publishes today's sample rates (development only).
 */
async function main() {
  const withSampleRates = process.argv.includes('--sample-rates');
  await dataSource.initialize();
  try {
    for (const [i, c] of CATEGORIES.entries()) {
      await dataSource.query(
        `INSERT INTO categories (code, name_bn, name_en, pricing_type, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
           SET name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en,
               pricing_type = EXCLUDED.pricing_type, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [c.code, c.nameBn, c.nameEn, c.pricingType, c.icon, i],
      );
    }
    console.log(`Categories: ${CATEGORIES.length} ready`);

    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      const [row] = await dataSource.query(
        `INSERT INTO users (phone, role, name) VALUES ($1, 'ADMIN', 'Admin')
         ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
         RETURNING role`,
        [adminPhone],
      );
      if (row.role !== 'ADMIN') {
        console.warn(`${adminPhone} already exists as ${row.role}; it was not made an admin.`);
      } else {
        console.log(`Admin: ${adminPhone} can sign in with OTP`);
      }
    } else {
      console.log('Admin: skipped (set ADMIN_PHONE to create one)');
    }

    if (withSampleRates) {
      if (process.env.NODE_ENV === 'production') throw new Error('Sample rates are for development only.');
      const today = dhakaToday();
      for (const [code, rate] of Object.entries(SAMPLE_RATES)) {
        await dataSource.query(
          `INSERT INTO daily_rates (category_id, effective_date, rate_per_kg)
           SELECT id, $2, $3 FROM categories WHERE code = $1
           ON CONFLICT (category_id, effective_date) DO NOTHING`,
          [code, today, rate],
        );
      }
      console.log(`Sample rates: published for ${today}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

await main();
