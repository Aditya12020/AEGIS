import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        originEstimates: true,
        satelliteObservations: {
          include: { spillObservations: true },
        },
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    const origin = incident.originEstimates[0];
    const spill = incident.satelliteObservations[0]?.spillObservations[0];
    const spillLat = spill?.centroidLat ?? incident.centerLat;
    const spillLon = spill?.centroidLon ?? incident.centerLon;
    const spillAreaKm2 = spill?.areaKm2 ?? null;

    if (!origin || (origin.backwardDistanceKm <= 0 && origin.uncertaintyRadiusKm <= 0)) {
      return res.status(200).json({
        status: 'DATA_UNAVAILABLE',
        message: 'No verified origin estimate available.',
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
      originLat: origin.originLat,
      originLon: origin.originLon,
      probabilityPercent: origin.probabilityPercent,
      releaseStartTime: origin.releaseStartTime,
      releaseEndTime: origin.releaseEndTime,
      backwardDistanceKm: origin.backwardDistanceKm,
      backwardBearingDeg: origin.backwardBearingDeg,
      uncertaintyRadiusKm: origin.uncertaintyRadiusKm,
      monteCarloParticles: origin.monteCarloParticles,
      convergencePercent: origin.convergencePercent,
      depthMeters: origin.depthMeters,
      corridorPoints: JSON.parse(origin.corridorPointsJson),
      methodology: origin.methodology,
      provenanceLabel: origin.provenanceLabel,
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
