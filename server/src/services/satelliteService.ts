import { prisma } from './db';
import { SatelliteDataProvider } from '../providers';
import { config } from '../config/env';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';

const inFlightAcquisitions = new Map<string, Promise<any>>();

function getPythonExecutable(): string {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  const venvPythonWin = path.resolve(__dirname, '../../ml/.venv/Scripts/python.exe');
  const venvPythonUnix = path.resolve(__dirname, '../../ml/.venv/bin/python');
  try {
    if (require('fs').existsSync(venvPythonWin)) return venvPythonWin;
    if (require('fs').existsSync(venvPythonUnix)) return venvPythonUnix;
  } catch {
    // fallback
  }
  return 'python';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function scenePayload(sat: any, incidentCode?: string) {
  return {
    sceneId: sat.sceneId,
    satellite: sat.satellite,
    sensor: sat.sensor,
    polarization: sat.polarization,
    acquisitionTime: sat.acquisitionTime,
    resolutionMeters: sat.resolutionMeters,
    incidenceAngleDeg: sat.incidenceAngleDeg,
    orbitNumber: sat.orbitNumber,
    orbitDirection: sat.orbitDirection,
    productType: sat.productType,
    source: sat.source,
    isLiveRealData: sat.isLiveRealData,
    provenanceDetails: sat.provenanceDetails,
    previewUrl: incidentCode ? `/api/satellite/${incidentCode}/preview` : undefined,
  };
}

async function runModelInference(
  rasterPath: string,
  bbox: [number, number, number, number],
  sceneId: string
): Promise<any> {
  const [minLat, minLon, maxLat, maxLon] = bbox;

  // 1. First attempt: Direct FastAPI upload
  try {
    const fileBuffer = await fs.readFile(rasterPath);
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: 'image/tiff' });
    form.append('file', blob, path.basename(rasterPath));

    const queryUrl = `${config.mlServiceUrl}/upload?minLat=${minLat}&minLon=${minLon}&maxLat=${maxLat}&maxLon=${maxLon}&allowUnverified=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(queryUrl, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (response.ok) {
        const json = await response.json();
        return json;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (httpErr) {
    // Fall back to direct Python invocation
  }

  // 2. Second attempt: Direct Python CLI invocation
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutable();
    execFile(
      pythonExe,
      ['-m', 'ml.inference', rasterPath, String(minLat), String(minLon), String(maxLat), String(maxLon), sceneId],
      { cwd: path.resolve(__dirname, '../../') },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`ML inference execution failed: ${err.message}. ${stderr}`));
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.status === 'ERROR') {
            return reject(new Error(parsed.message));
          }
          resolve(parsed);
        } catch (parseErr: any) {
          reject(new Error(`Could not parse ML output: ${parseErr.message}`));
        }
      }
    );
  });
}

export class SatelliteService {
  public static async getPreviewPath(incidentCodeOrId: string): Promise<string | null> {
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: incidentCodeOrId }, { incidentCode: incidentCodeOrId }] },
    });
    const folderId = incident?.id || incidentCodeOrId;

    const storageDir = path.resolve(__dirname, '../../storage/sentinel1', folderId);
    const previewPng = path.join(storageDir, 'preview.png');
    if (await fileExists(previewPng)) {
      return previewPng;
    }

    // Attempt to generate preview if tiff exists
    try {
      const files = await fs.readdir(storageDir);
      const tiff = files.find((f) => f.endsWith('.tif') || f.endsWith('.tiff'));
      if (tiff) {
        const tiffPath = path.join(storageDir, tiff);
        await new Promise<void>((resolve, reject) => {
          execFile(
            getPythonExecutable(),
            ['-m', 'ml.inference', '--preview', tiffPath, previewPng],
            { cwd: path.resolve(__dirname, '../../') },
            (err) => (err ? reject(err) : resolve())
          );
        });
        if (await fileExists(previewPng)) {
          return previewPng;
        }
      }
    } catch {
      // not generated
    }

    return null;
  }

  public static async getOrAcquireObservation(
    incidentCodeOrId: string,
    options: { waitForCompletion?: boolean } = {}
  ) {
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: incidentCodeOrId }, { incidentCode: incidentCodeOrId }] },
      include: {
        satelliteObservations: { include: { spillObservations: true } },
        investigations: true,
      },
    });

    if (!incident) return null;

    if (incident.satelliteObservations.length > 0) {
      const sat = incident.satelliteObservations[0];
      const spill = sat.spillObservations[0];
      return {
        status: spill ? 'READY' : 'SATELLITE_ACQUIRED',
        scene: scenePayload(sat, incident.incidentCode),
        spill: spill
          ? {
              areaKm2: spill.areaKm2,
              confidencePercent: spill.confidencePercent,
              centroid: [spill.centroidLat, spill.centroidLon],
              polygon:
                typeof spill.polygonGeoJson === 'string'
                  ? JSON.parse(spill.polygonGeoJson)
                  : spill.polygonGeoJson,
              thicknessMinMicrons: null,
              thicknessMaxMicrons: null,
              thicknessProvenance: 'DATA UNAVAILABLE',
              modelArchitecture: spill.modelArchitecture,
              provenanceLabel: spill.provenanceLabel,
              isModelOutput: spill.isModelOutput,
            }
          : null,
        modelStatus: spill ? 'MODEL OUTPUT' : 'MODEL NOT EXECUTED',
      };
    }

    if (inFlightAcquisitions.has(incident.id)) {
      if (options.waitForCompletion) {
        return await inFlightAcquisitions.get(incident.id);
      }
      return {
        status: 'SATELLITE_ACQUIRING',
        stage: 'SATELLITE_ACQUISITION',
        message: 'Sentinel-1 authenticated acquisition in progress.',
      };
    }

    const acquisitionPromise = (async () => {
      try {
        await prisma.investigation.updateMany({
          where: { incidentId: incident.id },
          data: { status: 'RUNNING', stage: 'SATELLITE_ACQUIRING' },
        });

        const provider = new SatelliteDataProvider();
        const satData = await provider.getObservation(
          incident.id,
          [incident.minLat, incident.minLon, incident.maxLat, incident.maxLon],
          incident.detectionTime.toISOString(),
        );

        if (satData.status !== 'SUCCESS') {
          await prisma.investigation.updateMany({
            where: { incidentId: incident.id },
            data: { status: 'SATELLITE_UNAVAILABLE', stage: 'SATELLITE_FAILED' },
          });
          return {
            status: satData.status,
            provenanceLabel: satData.provenanceLabel,
            message: satData.errorMessage || 'Sentinel-1 acquisition unavailable.',
          };
        }

        const incidentExists = await prisma.incident.findUnique({ where: { id: incident.id } });
        if (!incidentExists) {
          return {
            status: 'CANCELLED',
            provenanceLabel: 'DATA UNAVAILABLE',
            message: 'Incident was deleted or cancelled during Sentinel-1 acquisition.',
          };
        }

        const satObs = await prisma.satelliteObservation.upsert({
          where: { sceneId: satData.sceneId },
          create: {
            incidentId: incident.id,
            sceneId: satData.sceneId,
            satellite: satData.satellite,
            sensor: satData.sensor,
            polarization: satData.polarization,
            acquisitionTime: new Date(satData.acquisitionTime),
            resolutionMeters: satData.resolutionMeters,
            incidenceAngleDeg: satData.incidenceAngleDeg,
            orbitNumber: satData.orbitNumber,
            orbitDirection: satData.direction,
            productType: satData.productType,
            source: satData.source,
            isLiveRealData: true,
            provenanceDetails: JSON.stringify({
              provider: satData.provider,
              productId: satData.productId,
              mission: satData.mission,
              acquisitionStart: satData.acquisitionStart,
              acquisitionEnd: satData.acquisitionEnd,
              footprint: satData.footprintWkt,
              bbox: satData.bbox,
              referenceUrl: satData.downloadUrl,
              localProductPath: satData.localProductPath,
              downloadStatus: satData.localProductPath ? 'SUCCESS' : 'DATA UNAVAILABLE',
              processingStatus: 'ACQUIRED',
              acquisitionLabel: 'AUTOMATIC_SENTINEL1',
            }),
          },
          update: {
            incidentId: incident.id,
            provenanceDetails: JSON.stringify({
              provider: satData.provider,
              productId: satData.productId,
              referenceUrl: satData.downloadUrl,
              localProductPath: satData.localProductPath,
              acquisitionLabel: 'AUTOMATIC_SENTINEL1',
            }),
          },
        });

        // CONNECT THE EXISTING U-NET: Run inference if real raster was acquired
        let spillRecord = null;
        if (satData.localProductPath) {
          try {
            const mlResult = await runModelInference(
              satData.localProductPath,
              [incident.minLat, incident.minLon, incident.maxLat, incident.maxLon],
              satData.sceneId
            );

            const currentObs = await prisma.satelliteObservation.findUnique({ where: { id: satObs.id } });
            if (!currentObs) return { status: 'CANCELLED', message: 'Observation cancelled.' };

            await prisma.spillObservation.deleteMany({
              where: { satelliteObsId: satObs.id },
            });

            spillRecord = await prisma.spillObservation.create({
              data: {
                satelliteObsId: satObs.id,
                detectionTime: new Date(satData.acquisitionTime),
                areaKm2: mlResult.segmentation?.areaKm2 ?? 0.0,
                confidencePercent: mlResult.segmentation?.confidencePercent ?? 0.0,
                centroidLat: mlResult.segmentation?.centroid?.[0] ?? incident.centerLat,
                centroidLon: mlResult.segmentation?.centroid?.[1] ?? incident.centerLon,
                polygonGeoJson: JSON.stringify(
                  mlResult.segmentation?.polygonGeoJson ?? { type: 'Polygon', coordinates: [] }
                ),
                thicknessMinMicrons: -1.0,
                thicknessMaxMicrons: -1.0,
                modelArchitecture: mlResult.modelMetadata?.architecture ?? 'U-Net with ResNet-34 encoder',
                provenanceLabel: 'MODEL OUTPUT',
                isModelOutput: true,
              },
            });

            const slickFound = spillRecord.areaKm2 > 0;
            await prisma.investigation.updateMany({
              where: { incidentId: incident.id },
              data: {
                status: 'SATELLITE_ANALYZED',
                stage: slickFound ? 'SPILL_DETECTED' : 'NO_SPILL_DETECTED',
                notes: slickFound
                  ? `U-Net inference completed: oil slick detected (${spillRecord.areaKm2} km²). Model weights: unet_oilspill.pth.`
                  : `U-Net inference completed: NO oil slick detected in SAR raster (${mlResult.classification}).`,
              },
            });
          } catch (mlErr: any) {
            console.error('[SatelliteService] ML inference execution failed:', mlErr.message);
          }
        }

        return {
          status: spillRecord ? 'READY' : 'SATELLITE_ACQUIRED',
          provenanceLabel: 'LIVE / REAL DATA',
          scene: scenePayload(satObs, incident.incidentCode),
          spill: spillRecord
            ? {
                areaKm2: spillRecord.areaKm2,
                confidencePercent: spillRecord.confidencePercent,
                centroid: [spillRecord.centroidLat, spillRecord.centroidLon],
                polygon: JSON.parse(spillRecord.polygonGeoJson),
                thicknessMinMicrons: null,
                thicknessMaxMicrons: null,
                thicknessProvenance: 'DATA UNAVAILABLE',
                modelArchitecture: spillRecord.modelArchitecture,
                provenanceLabel: spillRecord.provenanceLabel,
                isModelOutput: spillRecord.isModelOutput,
              }
            : null,
          modelStatus: spillRecord ? 'MODEL OUTPUT' : 'MODEL EXECUTION PENDING',
          message: spillRecord
            ? `Sentinel-1 scene acquired and analyzed with U-Net: ${spillRecord.areaKm2 > 0 ? `Oil spill detected (${spillRecord.areaKm2} km²)` : 'No oil spill detected'}.`
            : 'Sentinel-1 product acquired and stored.',
        };
      } catch (error: any) {
        await prisma.investigation.updateMany({
          where: { incidentId: incident.id },
          data: { status: 'SATELLITE_UNAVAILABLE', stage: 'SATELLITE_FAILED' },
        });
        return {
          status: 'DATA_UNAVAILABLE',
          provenanceLabel: 'DATA UNAVAILABLE',
          message: error.message || 'Satellite acquisition pipeline failed.',
        };
      } finally {
        inFlightAcquisitions.delete(incident.id);
      }
    })();

    inFlightAcquisitions.set(incident.id, acquisitionPromise);

    if (options.waitForCompletion) {
      return await acquisitionPromise;
    }

    return Promise.race([
      acquisitionPromise,
      new Promise<any>((resolve) =>
        setTimeout(
          () =>
            resolve({
              status: 'SATELLITE_ACQUIRING',
              stage: 'SATELLITE_ACQUISITION',
              message: 'Sentinel-1 authenticated acquisition in progress.',
            }),
          1500,
        ),
      ),
    ]);
  }
}
