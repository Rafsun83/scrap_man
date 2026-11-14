import { S3PhotoStorage } from './s3-storage.js';

describe('S3PhotoStorage presigned links', () => {
  const storage = new S3PhotoStorage({
    S3_ENDPOINT: 'http://localhost:8333',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'bhangariwala-photos',
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
    S3_FORCE_PATH_STYLE: true,
  });
  afterAll(() => storage.destroy());

  it('signs uploads without a body checksum, so any file can be sent', async () => {
    const url = new URL(await storage.uploadUrl('pickups/p1/photo.jpg', 'image/jpeg', 600));
    expect(url.pathname).toBe('/bhangariwala-photos/pickups/p1/photo.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect([...url.searchParams.keys()].filter((k) => k.toLowerCase().includes('checksum'))).toEqual([]);
  });

  it('signs downloads for the same key', async () => {
    const url = new URL(await storage.downloadUrl('pickups/p1/photo.jpg', 900));
    expect(url.pathname).toBe('/bhangariwala-photos/pickups/p1/photo.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
  });
});
