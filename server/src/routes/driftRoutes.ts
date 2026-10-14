import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        driftObservations: true,
        satelliteObservations: {
          include: { spillObservations: true },
        },
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    const drift = incident.driftObservations[0];
    const spill = incident.satelliteObservations[0]?.spillObservations[0];
    const spillLat = spill?.centroidLat ?? incident.centerLat;
    const spillLon = spill?.centroidLon ?? incident.centerLon;
    const spillAreaKm2 = spill?.areaKm2 ?? null;

    if (!drift || (drift.netDriftSpeedKnots <= 0 && drift.currentSpeedKnots <= 0 && drift.windSpeedKnots <= 0)) {
      return res.status(200).json({
        status: 'DATA_UNAVAILABLE',
        message: 'No verified hydrodynamic drift calculation available for this investigation.',
        provenanceLabel: 'DATA UNAVAILABLE',
        spillLat,
        spillLon,
        spillAreaKm2,
        centerLat: incident.centerLat,
        centerLon: incident.centerLon,
        incidentCode: incident.incidentCode,
        incidentName: incident.name,
        result: null,
      });
    }

    const payload = {
      netDriftSpeedKnots: drift.netDriftSpeedKnots,
      netDriftDirectionDeg: drift.netDriftDirectionDeg,
      currentSpeedKnots: drift.currentSpeedKnots,
      currentDirectionDeg: drift.currentDirectionDeg,
      windSpeedKnots: drift.windSpeedKnots,
      windDirectionDeg: drift.windDirectionDeg,
      currentContributionPercent: drift.currentContributionPercent,
      windContributionPercent: drift.windContributionPercent,
      leewayFactor: drift.leewayFactor,
      projections: JSON.parse(drift.projectionsJson),
      nearestCoastline: {
        name: drift.nearestCoastName,
        distanceKm: drift.nearestCoastDistKm,
        threatWindowHours: drift.threatWindowHours,
      },
      confidence: drift.confidence,
      provenanceLabel: drift.provenanceLabel,
      methodology: drift.methodology,
      spillLat,
      spillLon,
      spillAreaKm2,
      centerLat: incident.centerLat,
      centerLon: incident.centerLon,
      incidentCode: incident.incidentCode,
      incidentName: incident.name,
    };

    res.json({
      status: 'SUCCESS',
      ...payload,
      result: payload,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
