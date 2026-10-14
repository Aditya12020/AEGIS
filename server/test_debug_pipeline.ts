import { prisma } from './src/services/db';
import { SatelliteDataProvider, OceanDataProvider, WeatherDataProvider } from './src/providers';
import { SatelliteService } from './src/services/satelliteService';

async function test() {
  try {
    const inc = await prisma.incident.findFirst({
      where: { incidentCode: 'INC-2026-4729' }
    });
    if (!inc) {
      console.log('Incident not found');
      return;
    }
    console.log('Found incident:', inc.incidentCode, inc.centerLat, inc.centerLon, inc.detectionTime);

    console.log('\n--- Testing SatelliteService.getOrAcquireObservation with timeout 15s ---');
    const satPromise = SatelliteService.getOrAcquireObservation(inc.id, { waitForCompletion: true });
    const satTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Sat acquisition timed out after 15s')), 15000));
    try {
      const satRes = await Promise.race([satPromise, satTimeout]);
      console.log('Satellite result:', JSON.stringify(satRes, null, 2));
    } catch (e: any) {
      console.error('Satellite error:', e.message);
    }

    console.log('\n--- Testing OceanDataProvider.getCurrent with timeout 15s ---');
    const oceanProvider = new OceanDataProvider();
    const oceanPromise = oceanProvider.getCurrent(inc.centerLat, inc.centerLon, inc.detectionTime.toISOString());
    const oceanTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Ocean timed out after 15s')), 15000));
    try {
      const oceanRes = await Promise.race([oceanPromise, oceanTimeout]);
      console.log('Ocean result:', (oceanRes as any).status, (oceanRes as any).currentSpeedKnots, (oceanRes as any).currentDirectionDeg);
    } catch (e: any) {
      console.error('Ocean error:', e.message);
    }

    console.log('\n--- Testing WeatherDataProvider.getWind with timeout 15s ---');
    const weatherProvider = new WeatherDataProvider();
    const weatherPromise = weatherProvider.getWind(inc.centerLat, inc.centerLon, inc.detectionTime.toISOString());
    const weatherTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Weather timed out after 15s')), 15000));
    try {
      const weatherRes = await Promise.race([weatherPromise, weatherTimeout]);
      console.log('Weather result:', (weatherRes as any).status, (weatherRes as any).windSpeedKnots, (weatherRes as any).windDirectionDeg);
    } catch (e: any) {
      console.error('Weather error:', e.message);
    }
  } catch (err: any) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

test();
