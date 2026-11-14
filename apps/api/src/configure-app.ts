import type { INestApplication } from '@nestjs/common';
import { ErrorFilter } from './common/error.filter.js';

/** Settings shared by the real server and the end-to-end tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableCors();
  app.enableShutdownHooks();
  return app;
}
