import { Router, Response, Request } from 'express';
import { prisma } from '../services/db';
import { authenticate, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { SatelliteService } from '../services/satelliteService';

const router = Router();

// GET satellite observation directly under /api/incidents/:code/satellite
router.get('/:code/satellite', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await SatelliteService.getOrAcquireObservation(code);
    if (!result) return res.status(404).json({ error: 'Incident not found' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all authorized incidents for current user / officer
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    
    let whereClause = {};
    if (user.role !== 'OFFICER') {
      whereClause = {
        OR: [
          { createdById: user.id },
          { incidentCode: '2026-ARABIAN-SEA-09' },
        ],
      };
    }

    const incidents = await prisma.incident.findMany({
      where: whereClause,
      orderBy: { detectionTime: 'desc' },
      include: {
        investigations: true,
        satelliteObservations: {
          include: { spillObservations: true },
        },
      },
    });
    res.json(incidents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single incident - allows authenticated and public investigation read
router.get('/:code', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.params;
    const user = req.user;

    const incident = await prisma.incident.findFirst({
      where: {
        OR: [{ id: code }, { incidentCode: code }],
      },
      include: {
        investigations: true,
        satelliteObservations: {
          include: { spillObservations: true },
        },
        driftObservations: true,
        originEstimates: true,
        suspectAnalyses: {
          include: { vessel: true, evidenceList: true },
          orderBy: { rank: 'asc' },
        },
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (user && user.role !== 'OFFICER' && incident.incidentCode !== '2026-ARABIAN-SEA-09' && incident.createdById !== user.id) {
      return res.status(403).json({ error: 'ACCESS RESTRICTED: You are not authorized to view this investigation dossier' });
    }

    res.json(incident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new incident
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { name, aoiName, minLat, maxLat, minLon, maxLon, centerLat, centerLon, detectionTime, isDemo } = req.body;

    let parsedMinLat: number;
    let parsedMaxLat: number;
    let parsedMinLon: number;
    let parsedMaxLon: number;
    let parsedCenterLat: number;
    let parsedCenterLon: number;
    let parsedDetectionTime: Date;

    if (isDemo === true) {
      // Explicit demo benchmark incident
      parsedMinLat = minLat != null ? parseFloat(minLat) : 21.65;
      parsedMaxLat = maxLat != null ? parseFloat(maxLat) : 22.05;
      parsedMinLon = minLon != null ? parseFloat(minLon) : 68.75;
      parsedMaxLon = maxLon != null ? parseFloat(maxLon) : 69.25;
      parsedCenterLat = centerLat != null ? parseFloat(centerLat) : 21.8033;
      parsedCenterLon = centerLon != null ? parseFloat(centerLon) : 68.9083;
      parsedDetectionTime = detectionTime ? new Date(detectionTime) : new Date('2026-09-03T14:20:18.000Z');
    } else {
      // Real investigation: Require explicit AOI coordinates and detection time
      if (
        minLat == null || maxLat == null || minLon == null || maxLon == null || !detectionTime
      ) {
        return res.status(400).json({
          error: 'AOI bounding coordinates (minLat, maxLat, minLon, maxLon) and detectionTime are required for real investigations. For demo benchmarking, set isDemo: true.',
        });
      }

      parsedMinLat = parseFloat(minLat);
      parsedMaxLat = parseFloat(maxLat);
      parsedMinLon = parseFloat(minLon);
      parsedMaxLon = parseFloat(maxLon);
      parsedCenterLat = centerLat != null ? parseFloat(centerLat) : (parsedMinLat + parsedMaxLat) / 2;
      parsedCenterLon = centerLon != null ? parseFloat(centerLon) : (parsedMinLon + parsedMaxLon) / 2;
      parsedDetectionTime = new Date(detectionTime);

      if (isNaN(parsedMinLat) || isNaN(parsedMaxLat) || isNaN(parsedMinLon) || isNaN(parsedMaxLon) ||
          isNaN(parsedCenterLat) || isNaN(parsedCenterLon) || isNaN(parsedDetectionTime.getTime())) {
        return res.status(400).json({ error: 'Invalid coordinate or timestamp values provided.' });
      }

      if (parsedMinLat >= parsedMaxLat || parsedMinLon >= parsedMaxLon) {
        return res.status(400).json({ error: 'minLat must be strictly less than maxLat, and minLon must be strictly less than maxLon.' });
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    const incidentCode = (isDemo ? 'DEMO-' : 'INC-') + year + '-' + randomSuffix;

    const incident = await prisma.incident.create({
      data: {
        incidentCode,
        name: name || (isDemo ? `Demo Benchmark ${incidentCode}` : `Investigation ${incidentCode}`),
        aoiName: aoiName || (isDemo ? 'Arabian Sea Demo Benchmark Basin' : 'Specified Maritime AOI'),
        minLat: parsedMinLat,
        maxLat: parsedMaxLat,
        minLon: parsedMinLon,
        maxLon: parsedMaxLon,
        centerLat: parsedCenterLat,
        centerLon: parsedCenterLon,
        detectionTime: parsedDetectionTime,
        status: 'ACTIVE',
        createdById: user.id,
        investigations: {
          create: {
            status: 'INITIALIZED',
            stage: 'SATELLITE_ACQUIRING',
            notes: isDemo
              ? `Demo benchmark initiated by ${user.name} (${user.role}).`
              : `Real investigation created by ${user.name} (${user.role}). Satellite search initialized.`,
          },
        },
        events: {
          create: {
            stage: 'INCIDENT_CREATED',
            title: isDemo ? 'Demo Benchmark Created' : 'Investigation AOI Established',
            description: `AOI: [${parsedMinLat}°N, ${parsedMinLon}°E to ${parsedMaxLat}°N, ${parsedMaxLon}°E]. Detection Time: ${parsedDetectionTime.toISOString()}.`,
            status: 'COMPLETED',
          },
        },
      },
      include: { investigations: true, events: true },
    });

    // Proactively start satellite observation acquisition in background
    SatelliteService.getOrAcquireObservation(incident.id).catch((e) => {
      console.error('[IncidentCreate] Background satellite acquisition error:', e.message);
    });

    res.status(201).json(incident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
