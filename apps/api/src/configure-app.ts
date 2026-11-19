import type { INestApplication } from '@nestjs/common';
import { ErrorFilter } from './common/error.filter.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';

/** Settings shared by the real server and the end-to-end tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ErrorFilter());
  app.enableCors({ exposedHeaders: ['X-Request-Id'] });
  app.enableShutdownHooks();
  return app;
}
