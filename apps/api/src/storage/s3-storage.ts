import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import type { Env } from '../config/env.js';
import type { PhotoStorage } from './storage.js';

type S3Settings = Pick<
  Env,
  'S3_ENDPOINT' | 'S3_REGION' | 'S3_BUCKET' | 'S3_ACCESS_KEY' | 'S3_SECRET_KEY' | 'S3_FORCE_PATH_STYLE'
>;

/** Photo storage on any S3-compatible service (SeaweedFS locally, S3 or R2 in production). */
export class S3PhotoStorage implements PhotoStorage {
  private readonly logger = new Logger('PhotoStorage');
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(settings: S3Settings) {
    this.bucket = settings.S3_BUCKET;
    this.client = new S3Client({
      endpoint: settings.S3_ENDPOINT,
      region: settings.S3_REGION,
      forcePathStyle: settings.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: settings.S3_ACCESS_KEY, secretAccessKey: settings.S3_SECRET_KEY },
      // By default the SDK signs a CRC32 of the (empty) body into presigned PUT URLs, so every real
      // upload then fails with BadDigest. Only add checksums where an operation requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  uploadUrl(key: string, contentType: string, expiresInSec: number): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInSec,
    });
  }

  downloadUrl(key: string, expiresInSec: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSec,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }

  /** Development convenience: creates the bucket if it is missing. Logs instead of failing start-up. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created photo bucket "${this.bucket}"`);
      } catch (error) {
        this.logger.warn(`Photo storage is not reachable; uploads will fail until it is. ${String(error)}`);
      }
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}
