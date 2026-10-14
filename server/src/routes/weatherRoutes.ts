import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { WeatherDataProvider, OpenMeteoWeatherProvider } from '../providers';
import { config } from '../config/env';
import { prisma } from '../services/db';

const router = Router();
const weatherProvider = new WeatherDataProvider();
const openMeteoProvider = new OpenMeteoWeatherProvider();

// In-memory asynchronous job store for long-running ERA5 requests
interface Era5Job {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  submittedAt: string;
  completedAt?: string;
  params: {
    latitude: number;
    longitude: number;
    timestamp: string;
    bbox?: [number, number, number, number];
  };
  result?: any;
  error?: string;
}

const jobStore = new Map<string, Era5Job>();

// Storage directory path
const STORAGE_DIR = path.resolve(__dirname, '../../storage/era5');

/**
 * GET /api/weather/status
 * Check configuration, credentials, storage, and supported variables.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    let cachedFilesCount = 0;
    let cachedStorageBytes = 0;

    if (fs.existsSync(STORAGE_DIR)) {
      const files = fs.readdirSync(STORAGE_DIR).filter((f) => f.endsWith('.nc'));
      cachedFilesCount = files.length;
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(STORAGE_DIR, file));
          cachedStorageBytes += stat.size;
        } catch {
          // ignore stat errors
        }
      }
    }

    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const cdsapircExists = homeDir ? fs.existsSync(path.join(homeDir, '.cdsapirc')) : false;

    const isConfigured = Boolean(config.era5.apiKey) || cdsapircExists;

    res.json({
      status: isConfigured ? 'CONFIGURED' : 'PROVIDER_NOT_CONFIGURED',
      provider: 'Copernicus Climate Change Service (C3S) - ECMWF ERA5',
      dataset: 'reanalysis-era5-single-levels',
      isConfigured,
      credentialDetection: {
        envApiKeyPresent: Boolean(config.era5.apiKey),
        cdsapircFilePresent: cdsapircExists,
      },
      cdsUrl: config.era5.cdsUrl || 'https://cds.climate.copernicus.eu/api',
      storageDirectory: STORAGE_DIR,
      cachedFilesCount,
      cachedStorageBytes,
      supportedVariables: [
        '10m_u_component_of_wind',
        '10m_v_component_of_wind',
        '2m_temperature',
        'surface_pressure',
        'total_precipitation',
      ],
      termsOfUseUrl:
        'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=download#manage-licences',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/weather/era5/point
 * Retrieve ERA5 reanalysis data for a point (lat, lon, timestamp).
 */
router.get('/era5/point', async (req: Request, res: Response) => {
  try {
    const { lat, lon, timestamp } = req.query;

    if (lat === undefined || lon === undefined || !timestamp) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Missing required query parameters: lat, lon, timestamp.',
      });
    }

    const latitude = parseFloat(String(lat));
    const longitude = parseFloat(String(lon));

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Latitude must be a valid float between -90 and 90.',
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Longitude must be a valid float between -180 and 180.',
      });
    }

    const dt = new Date(String(timestamp));
    if (isNaN(dt.getTime())) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Invalid ISO timestamp provided.',
      });
    }

    const result = await weatherProvider.getWind(latitude, longitude, dt.toISOString());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ status: 'DATA_UNAVAILABLE', error: err.message });
  }
});

/**
 * GET /api/weather/era5/incident/:code
 * Retrieve ERA5 weather data for a specific investigation incident.
 */
router.get('/era5/incident/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
    });

    if (!incident) {
      return res.status(404).json({ error: `Incident '${code}' not found.` });
    }

    const result = await weatherProvider.getWind(
      incident.centerLat,
      incident.centerLon,
      incident.detectionTime.toISOString()
    );

    res.json({
      incidentCode: incident.incidentCode,
      incidentName: incident.name,
      detectionTime: incident.detectionTime.toISOString(),
      centerCoordinates: {
        latitude: incident.centerLat,
        longitude: incident.centerLon,
      },
      weather: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/weather/era5/request
 * Submit an ERA5 data retrieval request (with asynchronous background option).
 */
router.post('/era5/request', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, timestamp, bbox, async } = req.body;

    if (latitude === undefined || longitude === undefined || !timestamp) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Missing required body fields: latitude, longitude, timestamp.',
      });
    }

    const lat = parseFloat(String(latitude));
    const lon = parseFloat(String(longitude));

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Invalid coordinates provided.',
      });
    }

    const dt = new Date(String(timestamp));
    if (isNaN(dt.getTime())) {
      return res.status(400).json({
        status: 'VALIDATION_ERROR',
        error: 'Invalid timestamp provided.',
      });
    }

    // If async background processing is requested
    if (async) {
      const jobId = 'job_era5_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const job: Era5Job = {
        jobId,
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
        params: { latitude: lat, longitude: lon, timestamp: dt.toISOString(), bbox },
      };
      jobStore.set(jobId, job);

      // Launch in background
      setImmediate(async () => {
        job.status = 'RUNNING';
        try {
          const data = await weatherProvider.getWind(lat, lon, dt.toISOString());
          job.status = data.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';
          job.result = data;
          job.completedAt = new Date().toISOString();
          if (data.status !== 'SUCCESS') {
            job.error = data.errorMessage;
          }
        } catch (jobErr: any) {
          job.status = 'FAILED';
          job.error = jobErr.message;
          job.completedAt = new Date().toISOString();
        }
      });

      return res.status(202).json({
        message: 'ERA5 retrieval job submitted to background queue.',
        jobId,
        status: 'PENDING',
        checkStatusUrl: `/api/weather/era5/jobs/${jobId}`,
      });
    }

    // Synchronous execution
    const data = await weatherProvider.getWind(lat, lon, dt.toISOString());
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ status: 'DATA_UNAVAILABLE', error: err.message });
  }
});

/**
 * GET /api/weather/era5/jobs/:jobId
 * Check status of an asynchronous ERA5 job.
 */
router.get('/era5/jobs/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ error: `Job '${jobId}' not found.` });
  }

  res.json(job);
});

/**
 * GET /api/weather/era5/files
 * List cached NetCDF products in local storage.
 */
router.get('/era5/files', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      return res.json({ files: [], totalCount: 0, totalSizeBytes: 0 });
    }

    const fileNames = fs.readdirSync(STORAGE_DIR).filter((f) => f.endsWith('.nc'));
    const files = fileNames.map((name) => {
      const fullPath = path.join(STORAGE_DIR, name);
      const stat = fs.statSync(fullPath);
      const metaName = name.replace('.nc', '.json');
      const metaPath = path.join(STORAGE_DIR, metaName);
      let metadata = null;
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {
          // ignore json parse error
        }
      }

      return {
        fileName: name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        metadata,
      };
    });

    const totalSizeBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    res.json({
      files,
      totalCount: files.length,
      totalSizeBytes,
      storageDirectory: STORAGE_DIR,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
