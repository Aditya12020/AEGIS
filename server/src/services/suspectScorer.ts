import { config } from '../config/env';

export interface SuspectScoreInput {
  vesselName: string;
  mmsi: string;
  vesselType: string;
  /** null when discharge origin is unavailable — no distance-to-origin may be computed */
  closestDistanceKm: number | null;
  timeDiffMinutes: number;
  trajectoryBearingDiffDeg: number;
  speedDropKnots: number;
  courseDeviationDeg: number;
  aisBlackoutMinutes: number;
}

export class SuspectScorer {
  public scoreSuspect(input: SuspectScoreInput) {
    // Origin-based proximity score: only valid when discharge origin exists
    const originAvailable = input.closestDistanceKm !== null && input.closestDistanceKm !== undefined;
    const proximityScore = originAvailable
      ? Math.max(0, Math.min(100, Math.round(100 * (1 - (input.closestDistanceKm as number) / 25))))
      : 0;

    const timeMatchScore = Math.max(0, Math.min(100, Math.round(100 * (1 - input.timeDiffMinutes / 120))));
    const trajectoryScore = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.min(90, input.trajectoryBearingDiffDeg) / 90))));
    const speedAnomalyScore = Math.max(10, Math.min(100, Math.round(10 + (Math.max(0, input.speedDropKnots) / 4.5) * 90)));

    const deviationBase = (Math.min(30, input.courseDeviationDeg) / 30) * 50;
    const blackoutBase = (Math.min(60, input.aisBlackoutMinutes) / 60) * 50;
    const routeDeviationScore = Math.max(10, Math.min(100, Math.round(deviationBase + blackoutBase)));

    const { scoringWeights } = config;

    // When origin is unavailable, redistribute the proximity weight across AIS/temporal indicators
    const effectiveProximityWeight = originAvailable ? scoringWeights.proximity : 0;
    const remainingWeight = originAvailable ? 0 : scoringWeights.proximity;
    const timeWeight = scoringWeights.timeMatch + remainingWeight * 0.5;
    const routeWeight = scoringWeights.routeDeviation + remainingWeight * 0.5;

    const overall =
      proximityScore * effectiveProximityWeight +
      timeMatchScore * timeWeight +
      trajectoryScore * scoringWeights.trajectory +
      speedAnomalyScore * scoringWeights.speedAnomaly +
      routeDeviationScore * routeWeight;

    const overallScore = Math.min(100, Math.max(0, Math.round(overall)));

    const evidenceItems: Array<{ category: string; title: string; description: string; scoreImpact: number; provenance: string }> = [];

    // Proximity evidence — only shown when origin is available
    if (originAvailable) {
      evidenceItems.push({
        category: 'Proximity',
        title: 'Corridor Proximity',
        description: `Vessel closest approach ${(input.closestDistanceKm as number).toFixed(1)} km from backtracked discharge origin.`,
        scoreImpact: proximityScore,
        provenance: 'AIS Track Geographic Projection',
      });
    } else {
      evidenceItems.push({
        category: 'Proximity',
        title: 'Origin Proximity Unavailable',
        description: 'Discharge origin is uncomputed or unavailable. Spatial proximity to release origin cannot be determined. Candidate evaluated independently on AIS kinematics only.',
        scoreImpact: 0,
        provenance: 'DATA UNAVAILABLE — Origin reconstruction blocked',
      });
    }

    evidenceItems.push({
      category: 'Temporal',
      title: 'Release Window Coincidence',
      description: input.timeDiffMinutes === 0
        ? 'Transit coincides with the estimated release window.'
        : `Transit occurred ${input.timeDiffMinutes} minutes offset from discharge window.`,
      scoreImpact: timeMatchScore,
      provenance: 'Temporal Cross-Correlation',
    });

    if (input.speedDropKnots >= 2.0) {
      evidenceItems.push({
        category: 'Speed Anomaly',
        title: 'Deceleration Anomaly',
        description: `Vessel decelerated by ${input.speedDropKnots.toFixed(1)} knots in the relevant sector.`,
        scoreImpact: speedAnomalyScore,
        provenance: 'Speed Over Ground Telemetry Analysis',
      });
    }

    if (input.aisBlackoutMinutes >= 15) {
      evidenceItems.push({
        category: 'AIS Continuity',
        title: 'AIS Telemetry Gap Detected',
        description: `Detected ${input.aisBlackoutMinutes} minutes gap in AIS broadcast reports during transit. Note: Gaps can result from transmission intervals, receiver coverage, satellite/terrestrial reception, or data limitations.`,
        scoreImpact: routeDeviationScore,
        provenance: 'AIS Broadcast Continuity Analysis',
      });
    }

    // Build narrative based on origin availability
    let narrative = `Candidate ${input.vesselName} (${input.vesselType}) received a computed candidate attribution score of ${overallScore}/100. [Candidate evaluation only — not proof of responsibility or legal liability]. `;

    if (!originAvailable) {
      narrative += `Discharge origin reconstruction unavailable; vessel evaluated independently on AIS kinematic signatures: speed anomaly ${input.speedDropKnots.toFixed(1)} kn, course deviation ${input.courseDeviationDeg.toFixed(1)}°, AIS reporting gap ${input.aisBlackoutMinutes} min.`;
    } else if (overallScore >= 80) {
      narrative += `Correlation indicators: Closest approach ${(input.closestDistanceKm as number).toFixed(1)} km from origin centroid during estimated discharge window with ${input.speedDropKnots.toFixed(1)} kn deceleration anomaly and ${input.aisBlackoutMinutes}-min AIS reporting gap.`;
    } else if (overallScore >= 50) {
      narrative += `Moderate correlation: Vessel traversed sector perimeter (${(input.closestDistanceKm as number).toFixed(1)} km from origin) with partial temporal alignment.`;
    } else {
      narrative += `Low correlation: Vessel separated by ${(input.closestDistanceKm as number).toFixed(1)} km with consistent cruising speed and uninterrupted AIS coverage.`;
    }

    return {
      overallScore,
      proximityScore,
      timeMatchScore,
      trajectoryScore,
      speedAnomalyScore,
      routeDeviationScore,
      originProximityAvailable: originAvailable,
      narrative,
      evidenceItems,
    };
  }
}
