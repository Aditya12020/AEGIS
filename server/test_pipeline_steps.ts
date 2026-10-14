import { prisma } from './src/services/db';
import { SatelliteService } from './src/services/satelliteService';
import { OceanDataProvider, WeatherDataProvider } from './src/providers';
import { DriftService } from './src/services/driftService';
import { OriginService } from './src/services/originService';
import { AisInvestigationService } from './src/services/aisInvestigationService';
import { ReportService } from './src/services/reportService';

async function stepByStep(code: string) {
  console.log(`\n=== STEP BY STEP EXECUTION FOR ${code} ===`);
  const incident = await prisma.incident.findFirst({
    where: { OR: [{ id: code }, { incidentCode: code }] },
    include: { investigations: true },
  });
  if (!incident) {
    console.error('Incident not found');
    return;
  }
  console.log('1. Found incident:', incident.incidentCode);

  console.log('2. Starting SatelliteService.getOrAcquireObservation...');
  const t0 = Date.now();
  const satelliteObs = await SatelliteService.getOrAcquireObservation(incident.id, { waitForCompletion: true });
  console.log(`2. Satellite completed in ${Date.now() - t0}ms:`, satelliteObs?.status, satelliteObs?.scene?.sceneId || 'no scene');

  console.log('3. Starting OceanDataProvider.getCurrent...');
  const t1 = Date.now();
  const oceanProvider = new OceanDataProvider();
  const ocean = await oceanProvider.getCurrent(incident.centerLat, incident.centerLon, incident.detectionTime.toISOString());
  console.log(`3. Ocean completed in ${Date.now() - t1}ms:`, ocean.status, ocean.currentSpeedKnots, ocean.errorMessage || '');

  console.log('4. Starting WeatherDataProvider.getWind...');
  const t2 = Date.now();
  const weatherProvider = new WeatherDataProvider();
  const weather = await weatherProvider.getWind(incident.centerLat, incident.centerLon, incident.detectionTime.toISOString());
  console.log(`4. Weather completed in ${Date.now() - t2}ms:`, weather.status, weather.windSpeedKnots, weather.errorMessage || '');

  console.log('5. Checking MetOcean and spill availability...');
  const spillObs = satelliteObs?.spill ?? null;
  const spillGeometryAvailable = Boolean(spillObs && spillObs.areaKm2 > 0);
  const oceanAvailable = ocean.status === 'SUCCESS';
  const weatherAvailable = weather.status === 'SUCCESS';
  console.log('Spill geom:', spillGeometryAvailable, 'Ocean:', oceanAvailable, 'Weather:', weatherAvailable);

  console.log('6. Running AIS attribution...');
  const t3 = Date.now();
  const aisInvestigationService = new AisInvestigationService();
  const aisResult = await aisInvestigationService.runAttribution(incident.incidentCode);
  console.log(`6. AIS completed in ${Date.now() - t3}ms, candidates:`, aisResult?.topCandidates?.length);

  console.log('7. Running ReportService.generateDossier...');
  const t4 = Date.now();
  const reportService = new ReportService();
  await reportService.generateDossier(incident.incidentCode);
  console.log(`7. Report completed in ${Date.now() - t4}ms`);

  console.log('=== ALL STEPS FINISHED SUCCESSFULLY ===');
}

async function main() {
  try {
    await stepByStep('INC-2026-4729');
  } catch (err: any) {
    console.error('Fatal error in stepByStep:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
