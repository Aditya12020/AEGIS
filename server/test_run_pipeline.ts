import express from 'express';
import http from 'http';
import investigationRoutes from './src/routes/investigationRoutes';

async function testRun() {
  const app = express();
  app.use(express.json());
  app.use('/api/investigations', investigationRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5097, resolve));

  console.log('Testing POST /api/investigations/INC-2026-4729/run...');
  const start = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:5097/api/investigations/INC-2026-4729/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const elapsed = Date.now() - start;
    console.log(`Status: ${res.status} in ${elapsed}ms`);
    const json = await res.json();
    console.log('Result:', JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error('Request failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

testRun();
