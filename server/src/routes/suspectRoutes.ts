import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        suspectAnalyses: {
          include: {
            vessel: true,
            evidenceList: true,
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const suspects = incident.suspectAnalyses.map((s) => ({
      id: s.id,
      mmsi: s.mmsi,
      rank: s.rank,
      vesselName: s.vessel.vesselName,
      vesselType: s.vessel.vesselType,
      flag: s.vessel.flag,
      overallScore: s.overallScore,
      proximityScore: s.proximityScore,
      timeMatchScore: s.timeMatchScore,
      trajectoryScore: s.trajectoryScore,
      speedAnomalyScore: s.speedAnomalyScore,
      routeDeviationScore: s.routeDeviationScore,
      closestDistanceKm: (s.closestDistanceKm != null && s.closestDistanceKm >= 0) ? s.closestDistanceKm : null,
      closestTime: s.closestTime,
      timeDiffMinutes: s.timeDiffMinutes,
      speedDropKnots: s.speedDropKnots,
      courseDeviationDeg: s.courseDeviationDeg,
      aisBlackoutMinutes: s.aisBlackoutMinutes,
      narrative: s.narrative,
      provenanceLabel: s.provenanceLabel,
      evidence: s.evidenceList.map((e) => ({
        id: e.id,
        category: e.category,
        title: e.title,
        description: e.description,
        scoreImpact: e.scoreImpact,
        provenance: e.provenance,
      })),
    }));

    res.json({
      incidentCode: incident.incidentCode,
      suspects,
      comparisonChart: suspects.map((s) => ({
        name: s.vesselName,
        mmsi: s.mmsi,
        score: s.overallScore,
        proximity: s.proximityScore,
        temporal: s.timeMatchScore,
        trajectory: s.trajectoryScore,
        speedDrop: s.speedAnomalyScore,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
