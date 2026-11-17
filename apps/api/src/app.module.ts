import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CollectorsModule } from './modules/collectors/collectors.module.js';
import { ClockModule } from './common/clock.js';
import { IdempotencyInterceptor } from './common/idempotency.js';
import { validateEnv, type Env } from './config/env.js';
import { databaseOptions } from './database/database.options.js';
import { HealthModule } from './modules/health/health.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PickupsModule } from './modules/pickups/pickups.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...databaseOptions(config.get('DATABASE_URL', { infer: true })),
        autoLoadEntities: true,
      }),
    }),
    ClockModule,
    RedisModule,
    StorageModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    RealtimeModule,
    PickupsModule,
    JobsModule,
    NotificationsModule,
    CollectorsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class AppModule {}
