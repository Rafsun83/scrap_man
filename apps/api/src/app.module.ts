import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { validateEnv, type Env } from './config/env.js';
import { databaseOptions } from './database/database.options.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

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
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CatalogModule,
  ],
})
export class AppModule {}
