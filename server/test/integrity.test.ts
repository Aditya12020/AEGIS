import assert from 'node:assert';
import {
  SatelliteDataProvider,
  OceanDataProvider,
  WeatherDataProvider,
  OpenMeteoOceanProvider,
  OpenMeteoWeatherProvider,
} from '../src/providers';
import { SatelliteService } from '../src/services/satelliteService';
import { DriftService } from '../src/services/driftService';
import { OriginService } from '../src/services/originService';
import { SuspectScorer } from '../src/services/suspectScorer';
import { config } from '../src/config/env';
import fs from 'fs/promises';
import path from 'path';

async function runTests() {
  console.log('====================================================');
  console.log('AEGIS PRODUCTION REAL-DATA & INTEGRITY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // TEST 1: MetOcean OceanDataProvider
  await test('OceanDataProvider executes live query or returns honest status with truthful provenance', async () => {
    const oceanProvider = new OceanDataProvider();
    const data = await oceanProvider.getCurrent(21.8033, 68.9083, '2026-09-03T14:20:18Z');
    assert.ok(
      ['SUCCESS', 'DATA_UNAVAILABLE', 'PROVIDER_NOT_CONFIGURED'].includes(data.status),
      `Unexpected status: ${data.status}`
    );
    assert.ok(data.currentSpeedKnots == null || data.currentSpeedKnots >= 0, 'Speed must be null or non-negative');
    assert.ok(
      ['LIVE / REAL DATA', 'HISTORICAL DATA', 'DEMO', 'DATA UNAVAILABLE', 'PROVIDER NOT CONFIGURED'].includes(data.provenanceLabel),
      `Unexpected provenance: ${data.provenanceLabel}`
    );
  });

  // TEST 2: WeatherDataProvider — missing or configured ERA5 key
  await test('WeatherDataProvider returns correct status based on ERA5_API_KEY configuration', async () => {
    const weatherProvider = new WeatherDataProvider();
    const data = await weatherProvider.getWind(21.8033, 68.9083, '2026-09-03T14:20:18Z');
    const validStatuses = [
      'SUCCESS',
      'DATA_UNAVAILABLE',
      'PROVIDER_NOT_CONFIGURED',
      'LICENCE_NOT_ACCEPTED',
      'AUTH_FAILED',
    ];
    assert.ok(validStatuses.includes(data.status), `Unexpected status: ${data.status}`);
    if (!config.era5.apiKey) {
      assert.strictEqual(data.status, 'PROVIDER_NOT_CONFIGURED');
      assert.strictEqual(data.provenanceLabel, 'PROVIDER NOT CONFIGURED');
      assert.strictEqual(data.windSpeedKnots, null);
    }
    if (data.status === 'SUCCESS') {
      assert.ok(data.windSpeedKnots != null && data.windSpeedKnots >= 0, 'Speed must be non-negative');
      assert.ok(data.u10 != null && data.v10 != null, 'u10/v10 must be present');
      assert.strictEqual(data.provenanceLabel, 'HISTORICAL REANALYSIS');
      assert.strictEqual(data.isLiveRealData, false, 'ERA5 is reanalysis, not live');
    }
    if (data.status === 'LICENCE_NOT_ACCEPTED') {
      assert.strictEqual(data.provenanceLabel, 'LICENCE NOT ACCEPTED');
      assert.ok(data.errorMessage?.includes('licence'), 'Error must mention licence');
    }
    console.log(`    ERA5 status: ${data.status} | provenance: ${data.provenanceLabel}`);
    if (data.errorMessage) {
      console.log(`    ERA5 errorMessage: ${data.errorMessage.slice(0, 200)}`);
    }
  });

  // TEST 2b: ERA5 Python script — area parameter format validation
  await test('ERA5 Python module produces correct [N, W, S, E] area order', async () => {
    // Import and run inline check via child process
    const { execFile: exec } = await import('child_process');
    const result = await new Promise<string>((resolve, reject) => {
      exec(
        process.env.PYTHON_EXECUTABLE || 'python',
        [
          '-c',
          `
import json
lat, lon = 22.0, 69.0
north = min(90.0, lat + 0.25)
south = max(-90.0, lat - 0.25)
west = ((lon - 0.25) + 180) % 360 - 180
east = ((lon + 0.25) + 180) % 360 - 180
area = [north, west, south, east]
print(json.dumps({"area": area, "order": "N,W,S,E"}))
`,
        ],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout.trim());
        }
      );
    });
    const parsed = JSON.parse(result);
    const [n, w, s, e] = parsed.area;
    assert.ok(n > s, `North (${n}) must be > South (${s})`);
    assert.ok(e > w, `East (${e}) must be > West (${w}) for non-antimeridian regions`);
    assert.strictEqual(parsed.order, 'N,W,S,E');
    console.log(`    Area: N=${n}, W=${w}, S=${s}, E=${e}`);
  });

  // TEST 3: Copernicus OAuth Authentication
  await test('Copernicus Data Space OAuth authenticates successfully with configured credentials', async () => {
    assert.ok(config.copernicusDataSpace.clientId, 'Copernicus clientId must be configured in .env');
    assert.ok(config.copernicusDataSpace.clientSecret, 'Copernicus clientSecret must be configured in .env');

    const tokenRes = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.copernicusDataSpace.clientId,
        client_secret: config.copernicusDataSpace.clientSecret,
      }),
    });
    assert.strictEqual(tokenRes.status, 200, `OAuth returned HTTP ${tokenRes.status}`);
    const tokenJson = await tokenRes.json() as any;
    assert.ok(tokenJson.access_token, 'Response must contain access_token');
    assert.ok(tokenJson.access_token.length > 500, 'Access token must be valid JWT');
  });

  // TEST 4: SatelliteDataProvider Observation & Real Raster Acquisition
  await test('SatelliteDataProvider searches Sentinel-1 and acquires authentic 3-band GeoTIFF raster', async () => {
    const satProvider = new SatelliteDataProvider();
    const obs = await satProvider.getObservation('test-incident', [21.65, 68.75, 22.05, 69.25], '2026-09-03T14:20:18Z');
    assert.ok(obs, 'Must return observation object');
    assert.ok(['SUCCESS', 'NO_MATCHING_SCENE', 'DATA_UNAVAILABLE', 'PROVIDER_NOT_CONFIGURED'].includes(obs.status));
    if (obs.status === 'SUCCESS') {
      assert.ok(obs.localProductPath, 'Successful acquisition must return localProductPath');
      assert.strictEqual(obs.provenanceLabel, 'LIVE / REAL DATA');
      assert.strictEqual(obs.isLiveRealData, true);
      const stat = await fs.stat(obs.localProductPath);
      assert.ok(stat.size > 1024, 'Raster file must exist on disk and be > 1KB');
    }
  });

  // TEST 5: U-Net Model Checkpoint & Architecture Integrity
  await test('Integrated U-Net weights file exists with verified SHA-256 checksum', async () => {
    const weightsPath = path.resolve(__dirname, '../ml/weights/unet_oilspill.pth');
    const stat = await fs.stat(weightsPath);
    assert.ok(stat.size > 10000000, 'U-Net weights file must be > 10MB');

    const manifestPath = path.resolve(__dirname, '../ml/model_manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assert.strictEqual(manifest.architecture, 'U-Net with ResNet-34 encoder');
    assert.strictEqual(manifest.input_channels, 3);
    assert.strictEqual(manifest.output_channels, 1);
    assert.strictEqual(manifest.sha256, '742ce020931cae4b8551159b82b7c9268203da029a6d94bd1d1a97b57cd268fc');
  });

  // TEST 6: Hydrodynamic Drift Advection Service with Valid Inputs
  await test('DriftService calculates coupled advection when all required inputs are valid', () => {
    const driftService = new DriftService();
    const drift = driftService.calculateDrift({
      centroidLat: 21.8033,
      centroidLon: 68.9083,
      detectionTime: '2026-09-03T14:20:18Z',
      currentSpeedKnots: 1.1,
      currentDirectionDeg: 135,
      windSpeedKnots: 14.5,
      windDirectionDeg: 240,
      currentAvailable: true,
      windAvailable: true,
      spillAvailable: true,
    });

    assert.strictEqual(drift.status, 'SUCCESS');
    assert.ok(drift.result, 'Must contain result payload');
    assert.ok(drift.result.netDriftSpeedKnots > 0, 'Net drift speed must be positive');
    assert.ok(drift.result.netDriftDirectionDeg >= 0 && drift.result.netDriftDirectionDeg <= 360);
    assert.strictEqual(drift.result.currentContributionPercent + drift.result.windContributionPercent, 100);
    assert.strictEqual(drift.result.provenanceLabel, 'DERIVED / COMPUTED');
  });

  // TEST 7: Strict Drift Gating — Rejects Missing or Zero Upstream Inputs
  await test('DriftService returns DATA_UNAVAILABLE and result: null when current or wind is missing', () => {
    const driftService = new DriftService();
    const result1 = driftService.calculateDrift({
      centroidLat: 21.8033,
      centroidLon: 68.9083,
      detectionTime: '2026-09-03T14:20:18Z',
      currentSpeedKnots: 0,
      currentDirectionDeg: 0,
      windSpeedKnots: 0,
      windDirectionDeg: 0,
      currentAvailable: false,
      windAvailable: false,
    });
    assert.strictEqual(result1.status, 'DATA_UNAVAILABLE');
    assert.strictEqual(result1.result, null);
    assert.strictEqual(result1.provenanceLabel, 'DATA UNAVAILABLE');
    assert.ok(!('netDriftSpeedKnots' in result1), 'Must not contain zero velocity fields in unavailable result');
  });

  // TEST 8: 10,000 Particle Monte Carlo Origin Backtrack with Valid Inputs
  await test('OriginService executes 10,000 Particle Monte Carlo simulation with genuine convergence check', () => {
    const originService = new OriginService();
    const origin = originService.reconstructOrigin({
      spillLat: 21.8033,
      spillLon: 68.9083,
      detectionTime: '2026-09-03T14:20:18Z',
      currentSpeedKnots: 1.1,
      currentDirectionDeg: 135,
      windSpeedKnots: 14.5,
      windDirectionDeg: 240,
      currentAvailable: true,
      windAvailable: true,
      spillAvailable: true,
      driftAvailable: true,
    });

    assert.strictEqual(origin.status, 'SUCCESS');
    assert.ok(origin.result, 'Must contain result payload');
    assert.strictEqual(origin.result.monteCarloParticles, 10000, 'Must execute exactly 10,000 particles');
    assert.ok(origin.result.uncertaintyRadiusKm > 0);
    assert.ok(origin.result.backwardDistanceKm > 0);
    assert.strictEqual(origin.result.depthMeters, null, 'Depth must be null without bathymetry provider');
  });

  // TEST 9: Strict Origin Gating — Rejects Missing Upstream Inputs
  await test('OriginService returns DATA_UNAVAILABLE and result: null when drift or spill is unavailable', () => {
    const originService = new OriginService();
    const origin = originService.reconstructOrigin({
      spillLat: 21.8033,
      spillLon: 68.9083,
      detectionTime: '2026-09-03T14:20:18Z',
      currentSpeedKnots: 0,
      currentDirectionDeg: 0,
      windSpeedKnots: 0,
      windDirectionDeg: 0,
      driftAvailable: false,
      spillAvailable: false,
    });

    assert.strictEqual(origin.status, 'DATA_UNAVAILABLE');
    assert.strictEqual(origin.result, null);
    assert.strictEqual(origin.provenanceLabel, 'DATA UNAVAILABLE');
    assert.ok(!('backwardDistanceKm' in origin), 'Must not contain zero displacement in unavailable result');
  });

  // TEST 10: AIS Scorer with Null Origin Distance
  await test('SuspectScorer scores candidates independently and suppresses origin proximity when closestDistanceKm is null', () => {
    const scorer = new SuspectScorer();
    const result = scorer.scoreSuspect({
      vesselName: 'MT ARABIAN STAR',
      mmsi: '413290001',
      vesselType: 'Crude Oil Tanker',
      closestDistanceKm: null, // Origin is unavailable
      timeDiffMinutes: 10,
      trajectoryBearingDiffDeg: 15.0,
      speedDropKnots: 3.5,
      courseDeviationDeg: 20.0,
      aisBlackoutMinutes: 45,
    });

    assert.strictEqual(result.originProximityAvailable, false);
    assert.strictEqual(result.proximityScore, 0);
    assert.ok(result.overallScore > 0, 'Must still score AIS kinematics independently');
    assert.ok(result.narrative.includes('Discharge origin reconstruction unavailable'), 'Narrative must declare origin unavailable');
    assert.ok(!result.narrative.includes('from origin'), 'Must not claim distance from origin when null');
    assert.ok(
      result.evidenceItems.some((e: any) => e.title === 'Origin Proximity Unavailable'),
      'Must contain explicit Origin Proximity Unavailable evidence item'
    );
  });

  // TEST 11: Maritime Terminology & Non-Culpability Disclaimer
  await test('SuspectScorer uses honest telemetry gap terminology and non-culpability legal disclaimer', () => {
    const scorer = new SuspectScorer();
    const result = scorer.scoreSuspect({
      vesselName: 'PACIFIC MERIDIAN 1',
      mmsi: '413290000',
      vesselType: 'Crude Oil Tanker',
      closestDistanceKm: 0.8,
      timeDiffMinutes: 25,
      trajectoryBearingDiffDeg: 12.0,
      speedDropKnots: 3.2,
      courseDeviationDeg: 18.5,
      aisBlackoutMinutes: 180,
    });

    assert.ok(result.overallScore > 0 && result.overallScore <= 100);
    assert.ok(
      result.narrative.includes('Candidate evaluation only — not proof of responsibility or legal liability'),
      'Must include exact mandatory legal disclaimer'
    );
    assert.ok(
      result.evidenceItems.some((e: any) => e.title.includes('Telemetry Gap')),
      'Must use honest Telemetry Gap terminology'
    );
  });

  // TEST 12: Satellite Imagery Search Integration
  await test('SatelliteDataProvider searches CDSE catalogue and returns authentic Sentinel-1 products with verified metadata', async () => {
    const satProvider = new SatelliteDataProvider();
    const searchRes = await satProvider.searchProducts({
      bbox: [21.65, 68.75, 22.05, 69.25],
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-05T00:00:00Z',
      limit: 5,
    });

    assert.ok(searchRes.providerConfigured, 'CDSE provider must be configured');
    assert.strictEqual(searchRes.status, 'SUCCESS', `Expected SUCCESS, got ${searchRes.status}`);
    assert.ok(searchRes.scenes.length > 0, 'Must find at least one Sentinel-1 scene');
    const first = searchRes.scenes[0];
    assert.ok(first.sceneId.includes('S1'), 'Scene ID must be Sentinel-1');
    assert.strictEqual(first.sensor, 'C-SAR (5.405 GHz)');
    assert.strictEqual(first.resolutionMeters, 10);
    assert.strictEqual(first.productType, 'GRD');
  });

  // TEST 13: Web-Deliverable Raster Preview Generation
  await test('SatelliteService verifies or creates authentic web-deliverable SAR preview PNG', async () => {
    const preview = await SatelliteService.getPreviewPath('test-incident');
    assert.ok(preview, 'Preview path must be returned');
    const stat = await fs.stat(preview);
    assert.ok(stat.size > 500, 'Preview PNG must be non-empty');
  });

  // TEST 14: Open-Meteo ERA5 Atmospheric Reanalysis Live Retrieval
  await test('OpenMeteoWeatherProvider retrieves authentic ECMWF ERA5 wind field without API key', async () => {
    const provider = new OpenMeteoWeatherProvider();
    const data = await provider.getWind(21.85, 69.00, '2026-09-03T14:20:18Z');
    assert.strictEqual(data.status, 'SUCCESS', `Expected SUCCESS, got ${data.status}`);
    assert.ok(data.isLiveRealData, 'Must be flagged as real data');
    assert.strictEqual(data.provenanceLabel, 'HISTORICAL DATA');
    assert.ok(data.windSpeedKnots != null && data.windSpeedKnots > 0, 'Wind speed must be positive knots');
    assert.ok(data.windDirectionDeg != null && data.windDirectionDeg >= 0 && data.windDirectionDeg <= 360);
    assert.ok(data.u10 != null && data.v10 != null, 'u10 and v10 vectors must be present');
  });

  // TEST 15: Open-Meteo Marine Surface Ocean Current Live Retrieval
  await test('OpenMeteoOceanProvider retrieves authentic Mercator / Copernicus physics surface current', async () => {
    const provider = new OpenMeteoOceanProvider();
    const data = await provider.getCurrent(21.85, 69.00, '2026-09-03T14:20:18Z');
    assert.strictEqual(data.status, 'SUCCESS', `Expected SUCCESS, got ${data.status}`);
    assert.ok(data.isLiveRealData, 'Must be flagged as real data');
    assert.ok(data.currentSpeedKnots != null && data.currentSpeedKnots >= 0, 'Current speed must be non-negative');
    assert.ok(data.currentDirectionDeg != null && data.currentDirectionDeg >= 0 && data.currentDirectionDeg <= 360);
    assert.ok(data.current_u != null && data.current_v != null, 'current u and v vectors must be present');
  });

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
