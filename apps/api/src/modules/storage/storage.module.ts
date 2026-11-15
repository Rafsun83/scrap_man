import { Global, Inject, Module, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { S3PhotoStorageService } from './services/s3-photo-storage.service.js';
import type { PhotoStorage } from './types/photo-storage.type.js';

/** Injection token for the PhotoStorage contract; other modules depend on the contract only. */
export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');

export const UPLOAD_URL_TTL_SEC = 10 * 60;
export const DOWNLOAD_URL_TTL_SEC = 15 * 60;

@Global()
@Module({
  providers: [
    {
      provide: PHOTO_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new S3PhotoStorageService({
          S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
          S3_REGION: config.get('S3_REGION', { infer: true }),
          S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
          S3_ACCESS_KEY: config.get('S3_ACCESS_KEY', { infer: true }),
          S3_SECRET_KEY: config.get('S3_SECRET_KEY', { infer: true }),
          S3_FORCE_PATH_STYLE: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
        }),
    },
  ],
  exports: [PHOTO_STORAGE],
})
export class StorageModule implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.storage instanceof S3PhotoStorageService && this.config.get('NODE_ENV', { infer: true }) === 'development') {
      await this.storage.ensureBucket();
    }
  }

  onModuleDestroy(): void {
    if (this.storage instanceof S3PhotoStorageService) this.storage.destroy();
  }
}
