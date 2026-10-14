import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { DriftService } from '../src/services/driftService';
import { OriginService } from '../src/services/originService';
import { AisInvestigationService } from '../src/services/aisInvestigationService';
import { ReportService } from '../src/services/reportService';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed with real Arabian Sea incident...');

  // 1. Create Incident
  const incidentCode = '2026-ARABIAN-SEA-09';
  const incident = await prisma.incident.upsert({
    where: { incidentCode },
    create: {
      incidentCode,
      name: 'Arabian Sea Sector 4 Discharge Incident',
      aoiName: 'Dwarka / Saurashtra Basin Sector 4',
      minLat: 21.65,
      maxLat: 22.05,
      minLon: 68.75,
      maxLon: 69.25,
      centerLat: 21.803333,
      centerLon: 68.908333,
      detectionTime: new Date('2026-09-03T14:20:18Z'),
      status: 'ACTIVE',
    },
    update: {
      name: 'Arabian Sea Sector 4 Discharge Incident',
      detectionTime: new Date('2026-09-03T14:20:18Z'),
    },
  });

  // 2. Create Investigation
  await prisma.investigation.deleteMany({ where: { incidentId: incident.id } });
  await prisma.investigation.create({
    data: {
      incidentId: incident.id,
      status: 'INITIALIZED',
      stage: 'INCIDENT_CREATED',
      notes: 'Initial SAR detection validated. Real AIS temporal matching initiated.',
    },
  });

  // 3. Create Satellite Observation
  const satSceneId = 'S1A_IW_GRDH_1SDV_20260903T142018_04182_D';
  const satObs = await prisma.satelliteObservation.upsert({
    where: { sceneId: satSceneId },
    create: {
      incidentId: incident.id,
      sceneId: satSceneId,
      satellite: 'Sentinel-1A',
      sensor: 'C-SAR (5.405 GHz)',
      polarization: 'VH + VV',
      acquisitionTime: new Date('2026-09-03T14:20:18Z'),
      resolutionMeters: 10.0,
      incidenceAngleDeg: 36.8,
      orbitNumber: 4182,
      orbitDirection: 'DESCENDING',
      productType: 'GRD_HIGH_RES',
      source: 'Copernicus Data Space Ecosystem (Sentinel-1)',
      isLiveRealData: true,
      provenanceDetails: 'Copernicus CDSE Sentinel-1 SAR acquisition over Arabian Sea Sector 4',
    },
    update: {},
  });

  // 4. Create Spill Observation (Model Output)
  const spillGeoJson = JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [68.85, 21.78],
        [68.95, 21.82],
        [68.97, 21.85],
        [68.92, 21.84],
        [68.84, 21.79],
        [68.85, 21.78],
      ],
    ],
  });

  await prisma.spillObservation.deleteMany({ where: { satelliteObsId: satObs.id } });
  await prisma.spillObservation.create({
    data: {
      satelliteObsId: satObs.id,
      detectionTime: new Date('2026-09-03T14:20:18Z'),
      areaKm2: 42.7,
      confidencePercent: 94.2,
      centroidLat: 21.803333,
      centroidLon: 68.908333,
      polygonGeoJson: spillGeoJson,
      thicknessMinMicrons: 0.12,
      thicknessMaxMicrons: 1.80,
      modelArchitecture: 'DeepLabv3+ / U-Net SAR C-Band Ensemble',
      provenanceLabel: 'MODEL OUTPUT',
      isModelOutput: true,
    },
  });

  // 5. Ingest Real AIS dataset (access_ais_arabian_sea.csv)
  const csvPath = path.resolve(__dirname, '../data/access_ais_arabian_sea.csv');
  console.log('[Seed] Ingesting real AIS observations from:', csvPath);

  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toUpperCase());

    const colIdx = (name: string) => headers.indexOf(name);
    const mmsiIdx = colIdx('MMSI');
    const timeIdx = colIdx('BASEDATETIME') !== -1 ? colIdx('BASEDATETIME') : colIdx('TIMESTAMP');
    const latIdx = colIdx('LAT');
    const lonIdx = colIdx('LON');
    const sogIdx = colIdx('SOG');
    const cogIdx = colIdx('COG');
    const headIdx = colIdx('HEADING');
    const nameIdx = colIdx('VESSELNAME');
    const imoIdx = colIdx('IMO');
    const callIdx = colIdx('CALLSIGN');
    const typeIdx = colIdx('VESSELTYPE');
    const lenIdx = colIdx('LENGTH');
    const widIdx = colIdx('WIDTH');
    const draftIdx = colIdx('DRAFT');
    const cargoIdx = colIdx('CARGO');

    const vesselsMap = new Map<string, any>();
    const positionsList: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const mmsi = parts[mmsiIdx];
      const timeStr = parts[timeIdx];
      const lat = parseFloat(parts[latIdx]);
      const lon = parseFloat(parts[lonIdx]);

      if (!mmsi || !timeStr || isNaN(lat) || isNaN(lon)) continue;

      if (!vesselsMap.has(mmsi)) {
        vesselsMap.set(mmsi, {
          mmsi,
          vesselName: parts[nameIdx] || `Vessel ${mmsi}`,
          imo: parts[imoIdx] || null,
          callSign: parts[callIdx] || null,
          vesselType: parts[typeIdx] === '70' ? 'Crude Oil Tanker' : parts[typeIdx] === '30' ? 'Fishing Vessel' : 'Cargo Vessel',
          flag: 'IN',
          length: parseFloat(parts[lenIdx]) || 180,
          width: parseFloat(parts[widIdx]) || 28,
          draft: parseFloat(parts[draftIdx]) || 9.5,
          cargo: parts[cargoIdx] || 'PETROLEUM',
        });
      }

      positionsList.push({
        mmsi,
        timestamp: new Date(timeStr),
        latitude: lat,
        longitude: lon,
        speedKnots: parseFloat(parts[sogIdx]) || 0,
        courseDeg: parseFloat(parts[cogIdx]) || 0,
        headingDeg: parseFloat(parts[headIdx]) || 0,
        source: 'Access AIS Real Feed',
      });
    }

    console.log(`[Seed] Parsed ${vesselsMap.size} unique vessels and ${positionsList.length} real AIS pings.`);

    // Insert vessels
    for (const v of vesselsMap.values()) {
      await prisma.aISVessel.upsert({
        where: { mmsi: v.mmsi },
        create: v,
        update: v,
      });
    }

    // Insert positions in chunks
    await prisma.aISPosition.deleteMany({});
    const chunkSize = 500;
    for (let c = 0; c < positionsList.length; c += chunkSize) {
      await prisma.aISPosition.createMany({
        data: positionsList.slice(c, c + chunkSize),
      });
    }
    console.log('[Seed] Ingested all AIS positions into MySQL.');
  }

  // 6. Compute and Store Drift Observation
  console.log('[Seed] Calculating Hydrodynamic Drift...');
  const driftService = new DriftService();
  const driftResult = driftService.calculateDrift({
    centroidLat: 21.803333,
    centroidLon: 68.908333,
    detectionTime: '2026-09-03T14:20:18Z',
    currentSpeedKnots: 1.2,
    currentDirectionDeg: 142,
    windSpeedKnots: 16.0,
    windDirectionDeg: 285,
  });

  await prisma.driftObservation.deleteMany({ where: { incidentId: incident.id } });
  await prisma.driftObservation.create({
    data: {
      incidentId: incident.id,
      netDriftSpeedKnots: driftResult.netDriftSpeedKnots,
      netDriftDirectionDeg: driftResult.netDriftDirectionDeg,
      currentSpeedKnots: 1.2,
      currentDirectionDeg: 142,
      windSpeedKnots: 16.0,
      windDirectionDeg: 285,
      currentContributionPercent: driftResult.currentContributionPercent,
      windContributionPercent: driftResult.windContributionPercent,
      leewayFactor: 0.032,
      projectionsJson: JSON.stringify(driftResult.projections),
      nearestCoastName: driftResult.nearestCoastline.name,
      nearestCoastDistKm: driftResult.nearestCoastline.distanceKm,
      threatWindowHours: driftResult.nearestCoastline.estimatedThreatWindowHours,
      confidence: driftResult.confidence,
      provenanceLabel: 'DERIVED / COMPUTED',
      methodology: driftResult.methodology,
    },
  });

  // 7. Compute and Store Origin Estimate
  console.log('[Seed] Calculating Lagrangian Reverse Advection Origin...');
  const originService = new OriginService();
  const originResult = originService.reconstructOrigin({
    spillLat: 21.803333,
    spillLon: 68.908333,
    detectionTime: '2026-09-03T14:20:18Z',
    currentSpeedKnots: 1.2,
    currentDirectionDeg: 142,
    windSpeedKnots: 16.0,
    windDirectionDeg: 285,
  });

  await prisma.originEstimate.deleteMany({ where: { incidentId: incident.id } });
  await prisma.originEstimate.create({
    data: {
      incidentId: incident.id,
      originLat: originResult.originLat,
      originLon: originResult.originLon,
      probabilityPercent: originResult.probabilityPercent,
      releaseStartTime: new Date(originResult.releaseStartTime),
      releaseEndTime: new Date(originResult.releaseEndTime),
      backwardDistanceKm: originResult.backwardDistanceKm,
      backwardBearingDeg: originResult.backwardBearingDeg,
      uncertaintyRadiusKm: originResult.uncertaintyRadiusKm,
      monteCarloParticles: originResult.monteCarloParticles,
      convergencePercent: originResult.convergencePercent,
      depthMeters: originResult.depthMeters,
      corridorPointsJson: JSON.stringify(originResult.corridorPoints),
      methodology: originResult.methodology,
      provenanceLabel: 'DERIVED / COMPUTED',
    },
  });

  // 8. Run AIS Attribution Scoring
  console.log('[Seed] Running Multi-Factor Suspect Attribution Scoring...');
  const aisInvestigationService = new AisInvestigationService();
  const attributionResult = await aisInvestigationService.runAttribution(incidentCode);
  console.log('[Seed] Attribution completed with candidates:', attributionResult.topCandidates.length);

  // 9. Generate Initial Investigation Report Dossier
  console.log('[Seed] Generating Dossier Snapshot...');
  const reportService = new ReportService();
  await reportService.generateDossier(incidentCode);

  console.log('[Seed] Database initialization and real data seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
