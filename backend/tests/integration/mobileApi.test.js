/**
 * Integration tests for /api/mobile/v1/expenses — uses supertest against a
 * fresh express app with the pool and auth middleware mocked.
 *
 * The real DB is intentionally not touched. We assert that the route layer
 * builds the right queries, handles validation, conflicts, and the version
 * gate correctly.
 */

const express = require('express');

// Mock the database pool before requiring the route module.
const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

// Mock auth to inject a fixed user id.
jest.mock('../../src/middleware/auth', () => (req, _res, next) => {
  req.user = { id: '11111111-1111-1111-1111-111111111111', email: 'test@example.com' };
  next();
});

// Quieten logger output during tests.
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock object storage so receipt tests don't touch S3.
const mockPutObject = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockIsConfigured = jest.fn(() => true);
jest.mock('../../src/services/objectStorage', () => ({
  isConfigured: (...args) => mockIsConfigured(...args),
  putObject: (...args) => mockPutObject(...args),
  getSignedDownloadUrl: (...args) => mockGetSignedUrl(...args),
}));

const request = require('supertest');
const mobileApiRouter = require('../../src/routes/mobileApi');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/mobile/v1', mobileApiRouter);
  return app;
}

const APP_VERSION_OK = '1.5.0';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_ID = '9b1d2c0a-8e30-4e51-a1ab-9b1d2c0a8e30';
const SERVER_ID = 'e2c8a4e4-3a0e-49c1-a3a5-e2c8a4e43a0e';

beforeEach(() => {
  mockQuery.mockReset();
  mockPutObject.mockReset();
  mockGetSignedUrl.mockReset();
  mockIsConfigured.mockReset().mockReturnValue(true);
});

describe('version gate', () => {
  test('400 when X-App-Version is missing', async () => {
    const res = await request(buildApp()).get('/api/mobile/v1/health');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_app_version');
  });

  test('426 when X-App-Version is below the minimum', async () => {
    process.env.MOBILE_MIN_SUPPORTED_VERSION = '2.0.0';
    jest.resetModules();
    jest.doMock('../../src/config/database', () => ({
      pool: { query: mockQuery },
    }));
    jest.doMock('../../src/middleware/auth', () => (req, _res, next) => {
      req.user = { id: USER_ID };
      next();
    });
    const freshRouter = require('../../src/routes/mobileApi');
    const app = express();
    app.use(express.json());
    app.use('/api/mobile/v1', freshRouter);

    const res = await request(app)
      .get('/api/mobile/v1/health')
      .set('X-App-Version', '1.0.0');
    expect(res.status).toBe(426);
    expect(res.body.error).toBe('app_too_old');

    delete process.env.MOBILE_MIN_SUPPORTED_VERSION;
  });

  test('200 on /health with valid version', async () => {
    const res = await request(buildApp())
      .get('/api/mobile/v1/health')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.server_now).toBe('string');
  });
});

describe('POST /expenses/sync', () => {
  test('rejects when changes is not an array', async () => {
    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({ changes: 'oops' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('changes_must_be_array');
  });

  test('rejects batch larger than 100', async () => {
    const changes = Array.from({ length: 101 }, () => ({ op: 'delete', client_id: CLIENT_ID, client_updated_at: '2026-05-18T14:32:09Z' }));
    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({ changes });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('batch_too_large');
  });

  test('returns ok empty results for empty changes', async () => {
    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({ changes: [] });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('upsert (insert path): no existing row → inserts and returns server_record', async () => {
    // First call: SELECT existing → none
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Second call: INSERT ... RETURNING
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '1500.00',
        currency: 'PKR',
        fx_rate_to_pkr: null,
        amount_pkr: '1500.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        description: null,
        payee: null,
        payment_method: null,
        tax_year: '2025-26',
        tax_treatment: null,
        tax_section: null,
        included_in_return: false,
        created_at: new Date('2026-05-18T14:32:11Z'),
        updated_at: new Date('2026-05-18T14:32:11Z'),
        deleted_at: null,
        receipt_id: null,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 1500,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T14:32:09Z',
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      client_id: CLIENT_ID,
      server_id: SERVER_ID,
      status: 'ok',
    });
    expect(res.body.results[0].server_record.tax_year).toBe('2025-26');
    expect(res.body.results[0].server_record.amount).toBe(1500);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  test('conflict: existing row newer than client → status=conflict, no write', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '2000.00',
        currency: 'PKR',
        fx_rate_to_pkr: null,
        amount_pkr: '2000.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        updated_at: new Date('2026-05-18T15:00:00Z'), // newer than client
        created_at: new Date('2026-05-18T14:00:00Z'),
        deleted_at: null,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 1500,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T14:32:09Z',
        }],
      });

    expect(res.body.results[0].status).toBe('conflict');
    expect(res.body.results[0].reason).toBe('newer_on_server');
    expect(res.body.results[0].server_record.amount).toBe(2000);
    expect(mockQuery).toHaveBeenCalledTimes(1); // SELECT only, no write
  });

  test('strict-mode no-conflict: base matches prior → applies upsert', async () => {
    // Client says "I last saw the server at 15:00:00Z"; server also has
    // prior.updated_at = 15:00:00Z → no conflict, apply the upsert.
    const baseIso = '2026-05-18T15:00:00.000Z';
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '1000.00',
        currency: 'PKR',
        amount_pkr: '1000.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        updated_at: new Date(baseIso),
        created_at: new Date('2026-05-18T14:00:00Z'),
        deleted_at: null,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '1500.00',
        currency: 'PKR',
        amount_pkr: '1500.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        updated_at: new Date('2026-05-18T15:01:00Z'),
        created_at: new Date('2026-05-18T14:00:00Z'),
        deleted_at: null,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 1500,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T15:01:00Z',
          base_updated_at: baseIso,
        }],
      });

    expect(res.body.results[0].status).toBe('ok');
    expect(res.body.results[0].server_record.amount).toBe(1500);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  test('strict-mode conflict: prior moved past base → status=conflict, no write', async () => {
    // Client says "I last saw the server at 15:00:00Z" but the server has
    // since been updated to 15:05:00Z (e.g. by the web app) → conflict.
    // This is the case the old clock-based check silently overwrote when the
    // client's later edit timestamp was the most recent one.
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '3000.00',
        currency: 'PKR',
        amount_pkr: '3000.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        updated_at: new Date('2026-05-18T15:05:00Z'),
        created_at: new Date('2026-05-18T14:00:00Z'),
        deleted_at: null,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 1500,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T16:00:00Z',  // newer than server!
          base_updated_at: '2026-05-18T15:00:00Z',     // but stale base
        }],
      });

    expect(res.body.results[0].status).toBe('conflict');
    expect(res.body.results[0].reason).toBe('newer_on_server');
    expect(res.body.results[0].server_record.amount).toBe(3000);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test('strict-mode conflict: deleted_on_server when prior is gone but client has base', async () => {
    // Client thinks the row exists on the server (has a base) but it was
    // deleted there. Surface as conflict with server_record=null so the UI
    // can ask the user what to do.
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 500,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T16:00:00Z',
          base_updated_at: '2026-05-18T15:00:00Z',
        }],
      });

    expect(res.body.results[0].status).toBe('conflict');
    expect(res.body.results[0].reason).toBe('deleted_on_server');
    expect(res.body.results[0].server_record).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test('strict-mode new row: base=null + no prior → insert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: SERVER_ID,
        client_id: CLIENT_ID,
        amount: '750.00',
        currency: 'PKR',
        amount_pkr: '750.00',
        occurred_on: '2026-05-18',
        category: 'medical',
        updated_at: new Date('2026-05-18T17:00:00Z'),
        created_at: new Date('2026-05-18T17:00:00Z'),
        deleted_at: null,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 750,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T17:00:00Z',
          base_updated_at: null,
        }],
      });

    expect(res.body.results[0].status).toBe('ok');
    expect(res.body.results[0].server_record.amount).toBe(750);
  });

  test('invalid base_updated_at format → 400-style error in result', async () => {
    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [{
          op: 'upsert',
          client_id: CLIENT_ID,
          amount: 1,
          currency: 'PKR',
          occurred_on: '2026-05-18',
          category: 'medical',
          client_updated_at: '2026-05-18T17:00:00Z',
          base_updated_at: 'not-a-date',
        }],
      });

    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[0].reason).toBe('invalid_base_updated_at');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('validation failure does not stop the batch', async () => {
    // First change is invalid → no DB calls for it.
    // Second change is a valid delete with no prior row → 1 DB call (SELECT).
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/api/mobile/v1/expenses/sync')
      .set('X-App-Version', APP_VERSION_OK)
      .send({
        changes: [
          { op: 'upsert', client_id: 'not-a-uuid', amount: 10, currency: 'PKR', occurred_on: '2026-05-18', category: 'medical', client_updated_at: '2026-05-18T14:32:09Z' },
          { op: 'delete', client_id: CLIENT_ID, client_updated_at: '2026-05-18T14:32:09Z' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toEqual({ client_id: 'not-a-uuid', status: 'error', reason: 'invalid_client_id' });
    expect(res.body.results[1]).toMatchObject({ client_id: CLIENT_ID, status: 'ok' });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('GET /expenses', () => {
  test('returns expenses and a next_cursor when page is full', async () => {
    const limit = 2;
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          client_id: CLIENT_ID,
          amount: '1500.00', currency: 'PKR', fx_rate_to_pkr: null, amount_pkr: '1500.00',
          occurred_on: '2026-05-17', category: 'medical',
          updated_at: new Date('2026-05-18T14:00:00Z'),
          created_at: new Date('2026-05-17T10:00:00Z'),
          deleted_at: null,
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          client_id: '9b1d2c0a-8e30-4e51-a1ab-9b1d2c0a8e31',
          amount: '500.00', currency: 'PKR', fx_rate_to_pkr: null, amount_pkr: '500.00',
          occurred_on: '2026-05-18', category: 'transport',
          updated_at: new Date('2026-05-18T15:00:00Z'),
          created_at: new Date('2026-05-18T15:00:00Z'),
          deleted_at: null,
        },
      ],
    });

    const res = await request(buildApp())
      .get(`/api/mobile/v1/expenses?limit=${limit}`)
      .set('X-App-Version', APP_VERSION_OK);

    expect(res.status).toBe(200);
    expect(res.body.expenses).toHaveLength(2);
    expect(res.body.next_cursor).not.toBeNull();
    expect(typeof res.body.server_now).toBe('string');

    // Confirm query parameters: user_id, since, limit. No cursor on first page.
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe(USER_ID);
    expect(params[params.length - 1]).toBe(limit);
  });

  test('rejects invalid `since`', async () => {
    const res = await request(buildApp())
      .get('/api/mobile/v1/expenses?since=not-a-date')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_since');
  });

  test('rejects malformed cursor', async () => {
    const res = await request(buildApp())
      .get('/api/mobile/v1/expenses?cursor=junk')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_cursor');
  });
});

describe('POST /receipts', () => {
  test('returns 503 when object storage is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    const res = await request(buildApp())
      .post('/api/mobile/v1/receipts')
      .set('X-App-Version', APP_VERSION_OK)
      .attach('file', Buffer.from('jpeg-bytes'), { filename: 'r.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('object_storage_unavailable');
  });

  test('returns 400 when no file part is present', async () => {
    const res = await request(buildApp())
      .post('/api/mobile/v1/receipts')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_file');
  });

  test('rejects unsupported mime types with 415', async () => {
    const res = await request(buildApp())
      .post('/api/mobile/v1/receipts')
      .set('X-App-Version', APP_VERSION_OK)
      .attach('file', Buffer.from('exe-bytes'), {
        filename: 'r.exe', contentType: 'application/x-msdownload',
      });
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('unsupported_media_type');
  });

  test('happy path: uploads, inserts, returns receipt_id', async () => {
    // dedup lookup → no existing
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // insert
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }] });
    mockPutObject.mockResolvedValueOnce('receipts/.../abc.jpg');

    const res = await request(buildApp())
      .post('/api/mobile/v1/receipts')
      .set('X-App-Version', APP_VERSION_OK)
      .attach('file', Buffer.from('jpeg-bytes'), {
        filename: 'r.jpg', contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      receipt_id: 'r-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      mime_type: 'image/jpeg',
      already_existed: false,
    });
    expect(res.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(mockPutObject).toHaveBeenCalledTimes(1);
  });

  test('dedup: existing sha256 returns already_existed=true without re-upload', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'r-existing0-0000-0000-0000-000000000000',
        storage_key: 'receipts/.../abc.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 12345,
      }],
    });

    const res = await request(buildApp())
      .post('/api/mobile/v1/receipts')
      .set('X-App-Version', APP_VERSION_OK)
      .attach('file', Buffer.from('jpeg-bytes'), {
        filename: 'r.jpg', contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.already_existed).toBe(true);
    expect(res.body.receipt_id).toBe('r-existing0-0000-0000-0000-000000000000');
    expect(mockPutObject).not.toHaveBeenCalled();
  });
});

describe('GET /receipts/:id', () => {
  test('400 on malformed UUID', async () => {
    const res = await request(buildApp())
      .get('/api/mobile/v1/receipts/not-a-uuid')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_receipt_id');
  });

  test('404 when receipt does not belong to user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .get('/api/mobile/v1/receipts/aaaaaaaa-aaaa-1aaa-aaaa-aaaaaaaaaaaa')
      .set('X-App-Version', APP_VERSION_OK);
    expect(res.status).toBe(404);
  });

  test('returns a signed URL with TTL', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ storage_key: 'receipts/u/abc.jpg', mime_type: 'image/jpeg', size_bytes: 1024 }],
    });
    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/url');

    const res = await request(buildApp())
      .get('/api/mobile/v1/receipts/aaaaaaaa-aaaa-1aaa-aaaa-aaaaaaaaaaaa')
      .set('X-App-Version', APP_VERSION_OK);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: 'https://signed.example/url',
      expires_in: 900,
      mime_type: 'image/jpeg',
      size_bytes: 1024,
    });
    expect(mockGetSignedUrl).toHaveBeenCalledWith('receipts/u/abc.jpg', 900);
  });
});
