import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { createAppLogger } from './common/app-logger.js';
import { configureApp } from './configure-app.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const logger = createAppLogger();
  const app = configureApp(await NestFactory.create(AppModule, { logger }));
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`BhangariWala API on http://localhost:${port}/api/v1/health`, 'Bootstrap');
}
await bootstrap();
