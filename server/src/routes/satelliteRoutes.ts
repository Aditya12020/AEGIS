import { Router, Request, Response } from 'express';
import { SatelliteService } from '../services/satelliteService';
import { SatelliteDataProvider } from '../providers';

const router = Router({ mergeParams: true });

// Satellite Search endpoint - must precede /:code route
async function handleSearch(req: Request, res: Response) {
  try {
    const minLat = parseFloat(String(req.query.minLat ?? req.body.minLat));
    const minLon = parseFloat(String(req.query.minLon ?? req.body.minLon));
    const maxLat = parseFloat(String(req.query.maxLat ?? req.body.maxLat));
    const maxLon = parseFloat(String(req.query.maxLon ?? req.body.maxLon));
    const startDate = String(req.query.startDate ?? req.body.startDate ?? '2026-09-01');
    const endDate = String(req.query.endDate ?? req.body.endDate ?? '2026-09-05');
    const limit = parseInt(String(req.query.limit ?? req.body.limit ?? '10'), 10) || 10;

    if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) {
      return res.status(400).json({
        error: 'Valid numeric bbox required: minLat, minLon, maxLat, maxLon.',
      });
    }

    const provider = new SatelliteDataProvider();
    const result = await provider.searchProducts({
      bbox: [minLat, minLon, maxLat, maxLon],
      startDate,
      endDate,
      limit,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Satellite search failed' });
  }
}

router.get('/search', handleSearch);
router.post('/search', handleSearch);

// Stream real SAR raster PNG preview
router.get('/:code/preview', async (req: Request, res: Response) => {
  try {
    const code = req.params.code || (req.params as any).id;
    if (!code) {
      return res.status(400).json({ error: 'Incident code or ID is required' });
    }

    const previewPath = await SatelliteService.getPreviewPath(code);
    if (!previewPath) {
      return res.status(404).json({ error: 'Raster preview not available for this incident.' });
    }

    res.sendFile(previewPath, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get or trigger satellite observation for incident
router.get('/:code?', async (req: Request, res: Response) => {
  try {
    const code = req.params.code || (req.params as any).id;
    if (!code) {
      return res.status(400).json({ error: 'Incident code or ID is required' });
    }

    const result = await SatelliteService.getOrAcquireObservation(code);
    if (!result) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
