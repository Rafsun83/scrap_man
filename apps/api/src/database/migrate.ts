import 'reflect-metadata';
import dataSource from './data-source.js';

/** Applies pending migrations (each in its own transaction). The container runs this before starting the API. */
async function main() {
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(JSON.stringify({ level: 'log', context: 'Migrations', message: `${applied.length} applied`, names: applied.map((m) => m.name) }));
  } finally {
    await dataSource.destroy();
  }
}

await main();
