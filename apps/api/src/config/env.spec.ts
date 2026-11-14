import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://x' };

  it('fills defaults', () => {
    expect(validateEnv(base)).toEqual({ ...base, NODE_ENV: 'development', PORT: 3000 });
  });

  it('names every missing variable', () => {
    expect(() => validateEnv({})).toThrow('DATABASE_URL, REDIS_URL');
  });

  it('rejects a bad port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
