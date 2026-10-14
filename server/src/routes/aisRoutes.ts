import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

router.get('/:code/vessels', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        suspectAnalyses: {
          include: {
            vessel: {
              include: {
                positions: {
                  orderBy: { timestamp: 'asc' },
                },
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const vessels = incident.suspectAnalyses.map((s) => ({
      mmsi: s.mmsi,
      rank: s.rank,
      name: s.vessel.vesselName,
      type: s.vessel.vesselType,
      flag: s.vessel.flag,
      length: s.vessel.length,
      overallScore: s.overallScore,
      closestDistanceKm: (s.closestDistanceKm != null && s.closestDistanceKm >= 0) ? s.closestDistanceKm : null,
      closestTime: s.closestTime,
      speedDropKnots: s.speedDropKnots,
      aisBlackoutMinutes: s.aisBlackoutMinutes,
      positions: s.vessel.positions.map((p) => ({
        timestamp: p.timestamp,
        lat: p.latitude,
        lon: p.longitude,
        speed: p.speedKnots,
        course: p.courseDeg,
      })),
    }));

    res.json({
      incidentCode: incident.incidentCode,
      totalTracked: vessels.length,
      vessels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
