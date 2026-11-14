import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  console.log(`BhangariWala API on http://localhost:${port}/api/v1/health`);
}
await bootstrap();
