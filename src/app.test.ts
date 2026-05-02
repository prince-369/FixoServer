import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: unknown;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
  const appModule = await import('./app');
  app = appModule.default;
});

describe('GET /api/health', () => {
  it('returns ok status and timestamp', async () => {
    const response = await request(app as any).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
