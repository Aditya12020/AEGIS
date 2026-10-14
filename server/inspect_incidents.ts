import { prisma } from './src/services/db';

async function inspectIncident(code: string) {
  const inc = await prisma.incident.findFirst({
    where: { OR: [{ id: code }, { incidentCode: code }] },
    include: {
      investigations: true,
      satelliteObservations: { include: { spillObservations: true } },
      driftObservations: true,
      originEstimates: true,
      suspectAnalyses: true,
      events: true,
      reports: true,
    },
  });

  console.log('=== INCIDENT:', code, '===');
  if (!inc) {
    console.log('Not found in DB!');
    return;
  }
  console.log('ID:', inc.id);
  console.log('Code:', inc.incidentCode);
  console.log('Name:', inc.name);
  console.log('AOI:', inc.aoiName, 'center:', inc.centerLat, inc.centerLon, 'detection:', inc.detectionTime);
  console.log('Status:', inc.status);
  console.log('Investigations count:', inc.investigations.length);
  for (const inv of inc.investigations) {
    console.log('  Inv stage:', inv.stage, 'status:', inv.status, 'candidates:', inv.highPriorityCandidates);
  }
  console.log('SatelliteObs count:', inc.satelliteObservations.length);
  for (const sat of inc.satelliteObservations) {
    console.log('  Sat sceneId:', sat.sceneId, 'satellite:', sat.satellite, 'source:', sat.source, 'spills:', sat.spillObservations.length);
    for (const sp of sat.spillObservations) {
      console.log('    Spill areaKm2:', sp.areaKm2, 'centroid:', sp.centroidLat, sp.centroidLon);
    }
  }
  console.log('DriftObs count:', inc.driftObservations.length);
  for (const d of inc.driftObservations) {
    console.log('  Drift speed:', d.netDriftSpeedKnots, 'dir:', d.netDriftDirectionDeg, 'windKnots:', d.windSpeedKnots, 'currKnots:', d.currentSpeedKnots);
  }
  console.log('OriginEstimates count:', inc.originEstimates.length);
  for (const o of inc.originEstimates) {
    console.log('  Origin coords:', o.originLat, o.originLon, 'prob:', o.probabilityPercent, 'distKm:', o.backwardDistanceKm);
  }
  console.log('SuspectAnalyses count:', inc.suspectAnalyses.length);
  console.log('Events count:', inc.events.length);
  for (const ev of inc.events) {
    console.log(`  Event [${ev.stage}]: ${ev.title} (${ev.status})`);
  }
  console.log('Reports count:', inc.reports.length);
}

async function main() {
  await inspectIncident('INC-2026-3422');
  console.log('\n----------------------------------------\n');
  await inspectIncident('INC-2026-4729');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
