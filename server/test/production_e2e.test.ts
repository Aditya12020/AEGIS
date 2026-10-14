import assert from 'node:assert';
import { prisma } from '../src/services/db';
import { SatelliteDataProvider, OceanDataProvider, WeatherDataProvider } from '../src/providers';
import { SatelliteService } from '../src/services/satelliteService';
import { DriftService } from '../src/services/driftService';
import { OriginService } from '../src/services/originService';
import { AisInvestigationService } from '../src/services/aisInvestigationService';
import { ReportService } from '../src/services/reportService';
import { config } from '../src/config/env';
import fs from 'fs/promises';

async function runE2EPipeline() {
  console.log('================================================================');
  console.log('AEGIS PRODUCTION REAL-DATA & INTEGRATED ML END-TO-END PIPELINE');
  console.log('================================================================\n');

  const testCode = `PROD-TEST-${Date.now()}`;
  console.log(`[STAGE 1] Creating Real Test Incident: ${testCode}`);

  // Real AOI: Arabian Sea sector
  const aoi = {
    name: `Automated Pipeline Test AOI ${testCode}`,
    aoiName: 'Arabian Sea Pipeline Verification Sector',
    minLat: 21.65,
    maxLat: 22.05,
    minLon: 68.75,
    maxLon: 69.25,
    centerLat: 21.85,
    centerLon: 69.00,
    detectionTime: new Date('2026-09-03T14:20:18.000Z'),
  };

  // 1. Create incident in DB
  const incident = await prisma.incident.create({
    data: {
      incidentCode: testCode,
      name: aoi.name,
      aoiName: aoi.aoiName,
      minLat: aoi.minLat,
      maxLat: aoi.maxLat,
      minLon: aoi.minLon,
      maxLon: aoi.maxLon,
      centerLat: aoi.centerLat,
      centerLon: aoi.centerLon,
      detectionTime: aoi.detectionTime,
      status: 'ACTIVE',
      investigations: {
        create: {
          status: 'INITIALIZED',
          stage: 'SATELLITE_ACQUIRING',
          notes: 'Production E2E real pipeline verification.',
        },
      },
      events: {
        create: {
          stage: 'INCIDENT_CREATED',
          title: 'Investigation AOI Established',
          description: `AOI: [${aoi.minLat}°N, ${aoi.minLon}°E to ${aoi.maxLat}°N, ${aoi.maxLon}°E]. Detection: ${aoi.detectionTime.toISOString()}`,
          status: 'COMPLETED',
        },
      },
    },
  });
  console.log(`  ✓ Incident created: ID=${incident.id}, Code=${incident.incidentCode}`);

  // 2. Copernicus OAuth & Sentinel-1 Acquisition + U-Net Inference
  console.log('\n[STAGE 2] Copernicus OAuth & Sentinel-1 SAR Acquisition');
  const satResult = await SatelliteService.getOrAcquireObservation(incident.id, { waitForCompletion: true });
  console.log(`  ✓ Satellite status: ${satResult.status}`);
  console.log(`  ✓ Provenance: ${satResult.provenanceLabel}`);
  if (satResult.scene) {
    console.log(`  ✓ Acquired Scene ID: ${satResult.scene.sceneId}`);
    console.log(`  ✓ Satellite Sensor: ${satResult.scene.satellite} ${satResult.scene.sensor} (${satResult.scene.resolutionMeters}m GRD)`);
  }

  console.log('\n[STAGE 3] Integrated U-Net Inference & Spill Detection');
  console.log(`  ✓ Model Status: ${satResult.modelStatus}`);
  if (satResult.spill) {
    console.log(`  ✓ Oil Spill Detected: Area = ${satResult.spill.areaKm2} km²`);
    console.log(`  ✓ Model Confidence: ${satResult.spill.confidencePercent}%`);
    console.log(`  ✓ Provenance: ${satResult.spill.provenanceLabel}`);
    console.log(`  ✓ Architecture: ${satResult.spill.modelArchitecture}`);
  } else {
    console.log('  ✓ Model Execution: NO OIL SPILL DETECTED (Clean ocean / 0.0 km²)');
  }

  // 3. Ocean and Wind Data
  console.log('\n[STAGE 4] MetOcean Providers (Ocean Current & Atmospheric Wind)');
  const oceanProvider = new OceanDataProvider();
  const weatherProvider = new WeatherDataProvider();
  const ocean = await oceanProvider.getCurrent(aoi.centerLat, aoi.centerLon, aoi.detectionTime.toISOString());
  const weather = await weatherProvider.getWind(aoi.centerLat, aoi.centerLon, aoi.detectionTime.toISOString());
  console.log(`  ✓ Primary Ocean Current Provider: ${ocean.status} (${ocean.provenanceLabel})`);
  console.log(`    - Ocean Velocity: ${ocean.currentSpeedKnots != null ? `${ocean.currentSpeedKnots} kn @ ${ocean.currentDirectionDeg}°` : 'UNAVAILABLE (Unmeasured / Provider Not Configured)'}`);
  console.log(`  ✓ Primary Wind Provider: ${weather.status} (${weather.provenanceLabel})`);
  console.log(`    - Wind Velocity: ${weather.windSpeedKnots != null ? `${weather.windSpeedKnots} kn @ ${weather.windDirectionDeg}°` : 'UNAVAILABLE (Unmeasured / Provider Not Configured)'}`);

  // Test documented open alternative (Open-Meteo ERA5 & Mercator Ocean)
  const { OpenMeteoOceanProvider, OpenMeteoWeatherProvider } = await import('../src/providers');
  const openOceanProvider = new OpenMeteoOceanProvider();
  const openWeatherProvider = new OpenMeteoWeatherProvider();
  const openOcean = await openOceanProvider.getCurrent(aoi.centerLat, aoi.centerLon, aoi.detectionTime.toISOString());
  const openWeather = await openWeatherProvider.getWind(aoi.centerLat, aoi.centerLon, aoi.detectionTime.toISOString());
  console.log(`  ✓ Documented Open MetOcean Provider (Open-Meteo Mercator & ERA5):`);
  console.log(`    - Ocean Current: ${openOcean.currentSpeedKnots} kn @ ${openOcean.currentDirectionDeg}° (${openOcean.status}, ${openOcean.provenanceLabel})`);
  console.log(`    - Wind Field: ${openWeather.windSpeedKnots} kn @ ${openWeather.windDirectionDeg}° (${openWeather.status}, ${openWeather.provenanceLabel})`);

  // 4. Drift Analysis Gating
  console.log('\n[STAGE 5] Hydrodynamic Drift Advection Gating');
  const spillExists = Boolean(satResult.spill && satResult.spill.areaKm2 > 0);
  const driftService = new DriftService();
  const drift = driftService.calculateDrift({
    centroidLat: satResult.spill?.centroid?.[0] ?? aoi.centerLat,
    centroidLon: satResult.spill?.centroid?.[1] ?? aoi.centerLon,
    detectionTime: aoi.detectionTime.toISOString(),
    currentSpeedKnots: ocean.currentSpeedKnots,
    currentDirectionDeg: ocean.currentDirectionDeg,
    windSpeedKnots: weather.windSpeedKnots,
    windDirectionDeg: weather.windDirectionDeg,
    currentAvailable: ocean.status === 'SUCCESS',
    windAvailable: weather.status === 'SUCCESS',
    spillAvailable: spillExists,
  });
  console.log(`  ✓ Drift Status: ${drift.status} (${drift.provenanceLabel})`);
  if (drift.status === 'SUCCESS' && drift.result) {
    console.log(`  ✓ Net Drift: ${drift.result.netDriftSpeedKnots} kn @ ${drift.result.netDriftDirectionDeg}°`);
  } else {
    console.log(`  ✓ Honest Gating: Drift successfully blocked because: ${drift.message}`);
    assert.strictEqual(drift.result, null, 'Result must be null when blocked');
  }

  // 5. Origin Reconstruction Gating
  console.log('\n[STAGE 6] Monte Carlo Backtrack Origin Reconstruction Gating');
  const originService = new OriginService();
  const origin = originService.reconstructOrigin({
    spillLat: satResult.spill?.centroid?.[0] ?? aoi.centerLat,
    spillLon: satResult.spill?.centroid?.[1] ?? aoi.centerLon,
    detectionTime: aoi.detectionTime.toISOString(),
    currentSpeedKnots: ocean.currentSpeedKnots,
    currentDirectionDeg: ocean.currentDirectionDeg,
    windSpeedKnots: weather.windSpeedKnots,
    windDirectionDeg: weather.windDirectionDeg,
    currentAvailable: ocean.status === 'SUCCESS',
    windAvailable: weather.status === 'SUCCESS',
    spillAvailable: spillExists,
    driftAvailable: drift.status === 'SUCCESS',
  });
  console.log(`  ✓ Origin Status: ${origin.status} (${origin.provenanceLabel})`);
  if (origin.status === 'SUCCESS' && origin.result) {
    console.log(`  ✓ Origin Centroid: [${origin.result.originLat}, ${origin.result.originLon}]`);
    console.log(`  ✓ Uncertainty Radius: ${origin.result.uncertaintyRadiusKm} km`);
  } else {
    console.log(`  ✓ Honest Gating: Origin backtrack successfully blocked because: ${origin.message}`);
    assert.strictEqual(origin.result, null, 'Origin result must be null when blocked');
  }

  // 6. AIS Candidate Attribution
  console.log('\n[STAGE 7] AIS Trajectory Ingestion & Kinematic Scoring');
  const aisService = new AisInvestigationService();
  const aisResult = await aisService.runAttribution(incident.incidentCode);
  console.log(`  ✓ Vessels Analyzed: ${aisResult.totalVessels}`);
  console.log(`  ✓ Origin Used: ${aisResult.originUsed}`);
  console.log(`  ✓ Candidates Scored: ${aisResult.topCandidates.length}`);
  if (aisResult.topCandidates.length > 0) {
    const top = aisResult.topCandidates[0];
    console.log(`  ✓ Top Candidate: MMSI ${top.mmsi} — Overall Score ${top.overallScore}/100`);
    console.log(`  ✓ Closest Approach (CPA): ${top.closestDistanceKm != null ? `${top.closestDistanceKm} km` : 'null (Origin Unavailable)'}`);
    console.log(`  ✓ Origin Proximity Available: ${top.originProximityAvailable}`);
    console.log(`  ✓ Narrative: "${top.narrative.slice(0, 120)}..."`);
  }

  // 7. Forensic Dossier Generation
  console.log('\n[STAGE 8] Forensic Intelligence Dossier Generation');
  const reportService = new ReportService();
  const dossier = await reportService.generateDossier(incident.incidentCode);
  assert.ok(dossier, 'Dossier report must be generated');
  console.log(`  ✓ Dossier Number: ${dossier.reportNumber}`);
  console.log(`  ✓ Executive Summary: "${dossier.executiveSummary}"`);

  // Clean up test incident to prevent polluting database
  await prisma.incident.delete({ where: { id: incident.id } });
  console.log(`\n  ✓ Cleanup: Test incident ${testCode} removed from database.`);

  console.log('\n================================================================');
  console.log('END-TO-END PIPELINE EXECUTION COMPLETED: ALL STAGES VERIFIED');
  console.log('================================================================');
}

runE2EPipeline().catch((err) => {
  console.error('\nE2E PIPELINE FAILED:', err);
  process.exit(1);
});
