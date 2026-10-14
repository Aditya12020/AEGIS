import { prisma } from './db';
import { haversineDistanceKm } from './driftService';
import { SuspectScorer } from './suspectScorer';

export class AisInvestigationService {
  private scorer: SuspectScorer;

  constructor() {
    this.scorer = new SuspectScorer();
  }

  public async runAttribution(incidentId: string) {
    const incident = await prisma.incident.findUnique({
      where: { incidentCode: incidentId },
      include: { originEstimates: true },
    });

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // INTEGRITY: Only use a real computed origin estimate.
    // If no origin estimate has been computed, origin-based proximity scoring is disabled.
    const originRecord = incident.originEstimates[0] ?? null;
    const originAvailable = originRecord !== null;

    const vessels = await prisma.aISVessel.findMany({
      include: {
        positions: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    // Temporal window: only defined when origin is available
    const releaseStartMs = originAvailable
      ? new Date(originRecord!.releaseStartTime).getTime()
      : null;
    const releaseEndMs = originAvailable
      ? new Date(originRecord!.releaseEndTime).getTime()
      : null;
    const timeTolMs = 120 * 60 * 1000; // 2 hours
    const geofenceKm = 50.0;

    let timeMatchedCount = 0;
    let geofenceMatchedCount = 0;
    let trajectoryMatchedCount = 0;

    const scoredCandidates: Array<{
      mmsi: string;
      rank: number;
      overallScore: number;
      proximityScore: number;
      timeMatchScore: number;
      trajectoryScore: number;
      speedAnomalyScore: number;
      routeDeviationScore: number;
      originProximityAvailable: boolean;
      closestDistanceKm: number | null;
      closestTime: Date;
      timeDiffMinutes: number;
      speedDropKnots: number;
      courseDeviationDeg: number;
      aisBlackoutMinutes: number;
      narrative: string;
      evidenceItems: any[];
    }> = [];

    for (const v of vessels) {
      if (v.positions.length === 0) continue;

      let minTimeDiffMs = Infinity;
      let hasTimeOverlap = false;

      if (originAvailable && releaseStartMs !== null && releaseEndMs !== null) {
        for (const p of v.positions) {
          const pMs = p.timestamp.getTime();
          if (pMs >= releaseStartMs - timeTolMs && pMs <= releaseEndMs + timeTolMs) {
            hasTimeOverlap = true;
            if (pMs >= releaseStartMs && pMs <= releaseEndMs) {
              minTimeDiffMs = 0;
            } else {
              const diff = Math.min(Math.abs(pMs - releaseStartMs), Math.abs(pMs - releaseEndMs));
              if (diff < minTimeDiffMs) minTimeDiffMs = diff;
            }
          }
        }
        if (hasTimeOverlap) timeMatchedCount++;
      }

      // Closest approach to origin — only when origin exists
      let minDistanceKm: number | null = null;
      let closestPos = v.positions[0];
      let hasGeofenceMatch = false;

      if (originAvailable && originRecord) {
        let minDist = Infinity;
        for (const p of v.positions) {
          const d = haversineDistanceKm(originRecord.originLat, originRecord.originLon, p.latitude, p.longitude);
          if (d < minDist) {
            minDist = d;
            closestPos = p;
          }
          if (d <= geofenceKm) hasGeofenceMatch = true;
        }
        minDistanceKm = parseFloat(minDist.toFixed(1));
        if (hasGeofenceMatch) geofenceMatchedCount++;

        const isTrajectoryMatch = minDist <= 35 && hasTimeOverlap;
        if (isTrajectoryMatch) trajectoryMatchedCount++;
      }

      // AIS kinematic anomaly calculations — always available
      let maxSpeedDrop = 0;
      let maxCourseDeviation = 0;
      let maxAisGapMinutes = 0;

      for (let i = 1; i < v.positions.length; i++) {
        const prev = v.positions[i - 1];
        const curr = v.positions[i];

        const sDrop = prev.speedKnots - curr.speedKnots;
        if (sDrop > maxSpeedDrop) maxSpeedDrop = sDrop;

        let cDiff = Math.abs(curr.courseDeg - prev.courseDeg);
        if (cDiff > 180) cDiff = 360 - cDiff;
        if (cDiff > maxCourseDeviation) maxCourseDeviation = cDiff;

        const dtMins = (curr.timestamp.getTime() - prev.timestamp.getTime()) / (60 * 1000);
        if (dtMins > maxAisGapMinutes) maxAisGapMinutes = dtMins;
      }

      const bearingDiff = Math.abs(closestPos.courseDeg - 242) % 180;
      const timeDiffMins = minTimeDiffMs === Infinity ? 240 : Math.round(minTimeDiffMs / (60 * 1000));

      const scoring = this.scorer.scoreSuspect({
        vesselName: v.vesselName,
        mmsi: v.mmsi,
        vesselType: v.vesselType,
        closestDistanceKm: minDistanceKm,          // null when origin unavailable
        timeDiffMinutes: timeDiffMins,
        trajectoryBearingDiffDeg: parseFloat(bearingDiff.toFixed(1)),
        speedDropKnots: parseFloat(maxSpeedDrop.toFixed(1)),
        courseDeviationDeg: parseFloat(maxCourseDeviation.toFixed(1)),
        aisBlackoutMinutes: Math.round(maxAisGapMinutes),
      });

      scoredCandidates.push({
        mmsi: v.mmsi,
        rank: 1,
        ...scoring,
        closestDistanceKm: minDistanceKm,
        closestTime: closestPos.timestamp,
        timeDiffMinutes: timeDiffMins,
        speedDropKnots: parseFloat(maxSpeedDrop.toFixed(1)),
        courseDeviationDeg: parseFloat(maxCourseDeviation.toFixed(1)),
        aisBlackoutMinutes: Math.round(maxAisGapMinutes),
      });
    }

    scoredCandidates.sort((a, b) => b.overallScore - a.overallScore);
    scoredCandidates.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    const highPriorityCandidates = scoredCandidates.filter((c) => c.overallScore >= 70).length;

    // Clean previous assessments for this incident
    await prisma.suspectAnalysis.deleteMany({
      where: { incidentId: incident.id },
    });

    // Save top candidates
    for (const c of scoredCandidates.slice(0, 10)) {
      await prisma.suspectAnalysis.create({
        data: {
          incidentId: incident.id,
          mmsi: c.mmsi,
          rank: c.rank,
          overallScore: c.overallScore,
          proximityScore: c.proximityScore,
          timeMatchScore: c.timeMatchScore,
          trajectoryScore: c.trajectoryScore,
          speedAnomalyScore: c.speedAnomalyScore,
          routeDeviationScore: c.routeDeviationScore,
          closestDistanceKm: c.closestDistanceKm != null ? c.closestDistanceKm : -1.0,
          closestTime: c.closestTime,
          timeDiffMinutes: c.timeDiffMinutes,
          speedDropKnots: c.speedDropKnots,
          courseDeviationDeg: c.courseDeviationDeg,
          aisBlackoutMinutes: c.aisBlackoutMinutes,
          narrative: c.narrative,
          provenanceLabel: originAvailable ? 'COMPUTED CANDIDATE SCORE' : 'COMPUTED CANDIDATE SCORE — ORIGIN UNAVAILABLE',
          evidenceList: {
            create: c.evidenceItems.map((e: any) => ({
              category: e.category,
              title: e.title,
              description: e.description,
              scoreImpact: e.scoreImpact,
              provenance: e.provenance,
            })),
          },
        },
      });
    }

    const calculatedConfidence = scoredCandidates.length > 0
      ? parseFloat((Math.min(95, Math.max(40, scoredCandidates[0].overallScore * 0.92))).toFixed(1))
      : 0.0;

    // Update Investigation summary
    await prisma.investigation.updateMany({
      where: { incidentId: incident.id },
      data: {
        status: 'ATTRIBUTION_CONVERGED',
        stage: 'ATTRIBUTION_COMPLETED',
        totalVesselsAnalyzed: vessels.length,
        vesselsAfterTimeFilter: timeMatchedCount,
        vesselsAfterGeofence: geofenceMatchedCount,
        trajectoryMatches: trajectoryMatchedCount,
        highPriorityCandidates,
        confidenceScore: calculatedConfidence,
        completedAt: new Date(),
      },
    });

    return {
      incidentId: incident.incidentCode,
      originUsed: originAvailable ? 'COMPUTED_ORIGIN' : 'NONE',
      totalVessels: vessels.length,
      timeMatched: timeMatchedCount,
      geofenceMatched: geofenceMatchedCount,
      trajectoryMatched: trajectoryMatchedCount,
      highPriorityCandidates,
      topCandidates: scoredCandidates.slice(0, 5),
    };
  }
}
