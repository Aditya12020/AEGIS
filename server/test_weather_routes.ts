import express from 'express';
import http from 'http';
import weatherRoutes from './src/routes/weatherRoutes';

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/weather', weatherRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));

  console.log('Testing ERA5 weather endpoints on ephemeral server port 5099...\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Weather status endpoint
  await test('GET /api/weather/status returns provider info and configured status', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    if (!json.provider.includes('ECMWF ERA5')) throw new Error('Wrong provider');
    if (json.dataset !== 'reanalysis-era5-single-levels') throw new Error('Wrong dataset');
    if (json.supportedVariables.length !== 5) throw new Error('Missing variables');
  });

  // 2. Point query validation errors
  await test('GET /api/weather/era5/point rejects missing params', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/point');
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
  });

  await test('GET /api/weather/era5/point rejects invalid latitude', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/point?lat=999&lon=68&timestamp=2024-01-15T12:00:00Z');
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
  });

  await test('GET /api/weather/era5/point rejects invalid timestamp', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/point?lat=22&lon=68&timestamp=not-a-date');
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
  });

  // 3. Point query execution
  await test('GET /api/weather/era5/point executes and returns valid status structure', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/point?lat=22.0&lon=69.0&timestamp=2024-01-15T12:00:00Z');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const valid = ['SUCCESS', 'LICENCE_NOT_ACCEPTED', 'AUTH_FAILED', 'DATA_UNAVAILABLE'];
    if (!valid.includes(json.status)) throw new Error(`Unexpected status ${json.status}`);
  });

  // 4. Async job submission
  await test('POST /api/weather/era5/request supports async job submission', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 22.0,
        longitude: 69.0,
        timestamp: '2024-01-15T12:00:00Z',
        async: true,
      }),
    });
    if (res.status !== 202) throw new Error(`Expected HTTP 202, got ${res.status}`);
    const json = await res.json() as any;
    if (!json.jobId) throw new Error('Missing jobId');

    // Query job status
    const statusRes = await fetch(`http://127.0.0.1:5099/api/weather/era5/jobs/${json.jobId}`);
    if (!statusRes.ok) throw new Error(`Failed to query job status: HTTP ${statusRes.status}`);
    const jobJson = await statusRes.json() as any;
    if (!['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'].includes(jobJson.status)) {
      throw new Error(`Unexpected job status: ${jobJson.status}`);
    }
  });

  // 5. Files list endpoint
  await test('GET /api/weather/era5/files returns storage directory inventory', async () => {
    const res = await fetch('http://127.0.0.1:5099/api/weather/era5/files');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    if (typeof json.totalCount !== 'number') throw new Error('Missing totalCount');
    if (typeof json.totalSizeBytes !== 'number') throw new Error('Missing totalSizeBytes');
  });

  server.close();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
