import express from 'express';
import http from 'http';
import driftRoutes from './src/routes/driftRoutes';
import originRoutes from './src/routes/originRoutes';
import incidentRoutes from './src/routes/incidentRoutes';
import investigationRoutes from './src/routes/investigationRoutes';
import weatherRoutes from './src/routes/weatherRoutes';

async function test() {
  const app = express();
  app.use(express.json());
  app.use('/api/drift', driftRoutes);
  app.use('/api/origin', originRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/investigations', investigationRoutes);
  app.use('/api/weather', weatherRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5098, resolve));

  for (const code of ['INC-2026-3422', 'INC-2026-4729']) {
    console.log(`\n=================== TESTING ${code} ===================`);
    
    // 1. GET /api/incidents/:code
    const incRes = await fetch(`http://127.0.0.1:5098/api/incidents/${code}`);
    console.log(`GET /api/incidents/${code} -> HTTP ${incRes.status}`);
    const incJson = await incRes.json();
    console.log(`  Incident found: ${incJson?.incidentCode || incJson?.error}`);

    // 2. GET /api/investigations/:code/status
    const statusRes = await fetch(`http://127.0.0.1:5098/api/investigations/${code}/status`);
    console.log(`GET /api/investigations/${code}/status -> HTTP ${statusRes.status}`);
    const statusJson = await statusRes.json();
    console.log(`  Status stage: ${statusJson?.stage}, status: ${statusJson?.status}, satelliteReady: ${statusJson?.satelliteReady}`);

    // 3. GET /api/drift/:code
    const driftRes = await fetch(`http://127.0.0.1:5098/api/drift/${code}`);
    console.log(`GET /api/drift/${code} -> HTTP ${driftRes.status}`);
    const driftJson = await driftRes.json();
    console.log(`  Drift status: ${driftJson?.status}, message: ${driftJson?.message}`);

    // 4. GET /api/origin/:code
    const originRes = await fetch(`http://127.0.0.1:5098/api/origin/${code}`);
    console.log(`GET /api/origin/${code} -> HTTP ${originRes.status}`);
    const originJson = await originRes.json();
    console.log(`  Origin status: ${originJson?.status}, message: ${originJson?.message}`);

    // 5. GET /api/weather/era5/incident/:code
    const weatherRes = await fetch(`http://127.0.0.1:5098/api/weather/era5/incident/${code}`);
    console.log(`GET /api/weather/era5/incident/${code} -> HTTP ${weatherRes.status}`);
  }

  server.close();
  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
