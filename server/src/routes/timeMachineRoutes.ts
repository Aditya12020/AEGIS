import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        satelliteObservations: {
          include: { spillObservations: true },
        },
        driftObservations: true,
        originEstimates: true,
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const sat = incident.satelliteObservations[0];
    const spill = sat?.spillObservations[0];
    const origin = incident.originEstimates[0];
    const drift = incident.driftObservations[0];

    // Scientific dependency gate: If satellite detection data is unavailable or no spill was detected, report honestly
    if (!sat || !spill || spill.areaKm2 <= 0) {
      return res.status(200).json({
        incidentCode: incident.incidentCode,
        available: false,
        status: 'DATA_UNAVAILABLE',
        error: !sat || !spill
          ? 'Timeline cannot be reconstructed: Upstream satellite detection observation is unavailable for this incident.'
          : 'Timeline cannot be reconstructed: Sentinel-1 SAR analysis detected NO surface oil spill in this AOI.',
        steps: [],
        spillAreaChart: [],
      });
    }

    const detectionTimeMs = new Date(incident.detectionTime).getTime();
    const observedArea = spill.areaKm2;

    const historySteps: any[] = [];

    // Step 0 & 1: Origin Backtrack (Only constructed when genuine origin estimate exists)
    if (origin && origin.backwardDistanceKm > 0) {
      const releaseTimeMs = new Date(origin.releaseStartTime).getTime();
      const originDistKm = origin.backwardDistanceKm;
      const midpointTimeMs = Math.round((releaseTimeMs + detectionTimeMs) / 2);

      historySteps.push({
        stepIndex: 0,
        timestamp: new Date(releaseTimeMs).toISOString(),
        label: `T-${((detectionTimeMs - releaseTimeMs) / 3600000).toFixed(1)}h: Estimated Discharge Window`,
        areaKm2: Math.round(observedArea * 0.15 * 10) / 10,
        driftDisplacementKm: 0.0,
        phase: 'Initial Surface Spread (Fay Phase I)',
        observationType: 'MODELLED',
        classification: 'MODELLED',
        provenance: origin.provenanceLabel || 'DERIVED / COMPUTED',
      });

      historySteps.push({
        stepIndex: 1,
        timestamp: new Date(midpointTimeMs).toISOString(),
        label: `T-${((detectionTimeMs - midpointTimeMs) / 3600000).toFixed(1)}h: Advective Transport Intermediate`,
        areaKm2: Math.round(observedArea * 0.55 * 10) / 10,
        driftDisplacementKm: Math.round(originDistKm * 0.5 * 10) / 10,
        phase: 'Advective Drift & Emulsification (Fay Phase II)',
        observationType: 'INTERPOLATED',
        classification: 'INTERPOLATED',
        provenance: 'DERIVED / COMPUTED',
      });
    } else {
      historySteps.push({
        stepIndex: 0,
        timestamp: new Date(detectionTimeMs - 3600000).toISOString(),
        label: 'Historical Backtrack Unavailable (Origin Uncomputed)',
        areaKm2: 0,
        driftDisplacementKm: 0,
        phase: 'Origin Reconstruction Blocked / MetOcean Unavailable',
        observationType: 'DATA_UNAVAILABLE',
        classification: 'DATA_UNAVAILABLE',
        provenance: 'DATA UNAVAILABLE',
      });
    }

    // Step 2: Sentinel-1 SAR Detection Anchor (Always present when spill exists)
    historySteps.push({
      stepIndex: 2,
      timestamp: new Date(detectionTimeMs).toISOString(),
      label: `T+0.0h: Sentinel-1 SAR Detection Anchor`,
      areaKm2: observedArea,
      driftDisplacementKm: origin?.backwardDistanceKm ?? 0.0,
      phase: 'Active SAR C-Band Observation',
      observationType: 'OBSERVED',
      classification: 'OBSERVED',
      provenance: sat.source === 'DEMO_REFERENCE_ASSET' ? 'DEMO' : 'LIVE / REAL DATA',
    });

    // Step 3: Forward Hydrodynamic Projection (Only constructed when genuine drift exists)
    if (drift && drift.netDriftSpeedKnots > 0) {
      let forwardTimeMs = detectionTimeMs + 12 * 3600 * 1000;
      let forwardDisplacementKm = drift.netDriftSpeedKnots * 12 * 1.852;
      let forwardAreaKm2 = Math.round(observedArea * 1.32 * 10) / 10;

      if (drift.projectionsJson) {
        try {
          const projections = JSON.parse(drift.projectionsJson);
          if (Array.isArray(projections) && projections.length > 0) {
            const lastProj = projections[projections.length - 1];
            if (lastProj.hoursAhead) {
              forwardTimeMs = detectionTimeMs + lastProj.hoursAhead * 3600 * 1000;
              forwardDisplacementKm = lastProj.distanceKm ?? forwardDisplacementKm;
              forwardAreaKm2 = lastProj.areaKm2 ?? forwardAreaKm2;
            }
          }
        } catch (e) {
          // Fallback to computed formula using real drift speed
        }
      }

      const baseDisplacement = origin?.backwardDistanceKm ?? 0.0;
      historySteps.push({
        stepIndex: 3,
        timestamp: new Date(forwardTimeMs).toISOString(),
        label: `T+${((forwardTimeMs - detectionTimeMs) / 3600000).toFixed(1)}h: Forward Hydrodynamic Projection`,
        areaKm2: forwardAreaKm2,
        driftDisplacementKm: Math.round((baseDisplacement + forwardDisplacementKm) * 10) / 10,
        phase: drift.nearestCoastName ? `Coastal Threat Warning (${drift.nearestCoastName})` : 'Dispersive Hydrodynamic Advection',
        observationType: 'PROJECTED',
        classification: 'PROJECTED',
        provenance: drift.provenanceLabel || 'DERIVED / COMPUTED',
      });
    } else {
      historySteps.push({
        stepIndex: 3,
        timestamp: new Date(detectionTimeMs + 3600000).toISOString(),
        label: 'Forward Hydrodynamic Projection Unavailable (Drift Uncomputed)',
        areaKm2: 0,
        driftDisplacementKm: 0,
        phase: 'Forward Advection Modeling Blocked',
        observationType: 'DATA_UNAVAILABLE',
        classification: 'DATA_UNAVAILABLE',
        provenance: 'DATA UNAVAILABLE',
      });
    }

    res.json({
      incidentCode: incident.incidentCode,
      available: true,
      currentDetectionTime: incident.detectionTime,
      steps: historySteps,
      spillAreaChart: historySteps
        .filter((s) => s.observationType !== 'DATA_UNAVAILABLE')
        .map((s) => ({
          timestamp: s.timestamp.slice(5, 16).replace('T', ' '),
          areaKm2: s.areaKm2,
          displacementKm: s.driftDisplacementKm,
          type: s.observationType,
          classification: s.classification,
        })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
