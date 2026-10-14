import {
  IOceanDataProvider,
  OceanData,
  IWeatherDataProvider,
  WeatherData,
  ISatelliteDataProvider,
  SatelliteObservationData,
  SatelliteProductSummary,
  SatelliteSearchResult,
} from './types';

import { config } from '../config/env';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';

export class OceanDataProvider implements IOceanDataProvider {
  public async getCurrent(lat: number, lon: number, timestamp: string): Promise<OceanData> {
    const fallback = async (reason: string): Promise<OceanData> => {
      console.warn(`[OceanDataProvider] Primary Copernicus Marine query failed (${reason}); trying Open-Meteo Marine physics model fallback...`);
      try {
        const om = new OpenMeteoOceanProvider();
        const res = await om.getCurrent(lat, lon, timestamp);
        if (res.status === 'SUCCESS') {
          return {
            ...res,
            attribution: `Mercator Ocean / Copernicus Marine Physics (via Open-Meteo). Primary direct query: ${reason}`,
          };
        }
      } catch (err: any) {
        console.warn(`[OceanDataProvider] Open-Meteo Marine fallback failed: ${err.message}`);
      }
      return {
        timestamp,
        latitude: lat,
        longitude: lon,
        current_u: null,
        current_v: null,
        currentSpeedKnots: null,
        currentDirectionDeg: null,
        source: 'Copernicus Marine Service',
        isLiveRealData: false,
        attribution: `Copernicus Marine current unavailable: ${reason}`,
        provenanceLabel: 'DATA UNAVAILABLE',
        status: 'DATA_UNAVAILABLE',
        errorMessage: reason,
      };
    };

    if (!config.copernicusMarine.username || !config.copernicusMarine.password) {
      return await fallback('Copernicus Marine credentials are not configured in server/.env');
    }

    return new Promise((resolve) => {
      const script = path.resolve(__dirname, '../../ml/marine.py');
      execFile(
        process.env.PYTHON_EXECUTABLE || 'python',
        [script, String(lat), String(lon), timestamp],
        {
          cwd: path.resolve(__dirname, '../../'),
          timeout: 15000,
          env: {
            ...process.env,
            COPERNICUS_MARINE_USERNAME: config.copernicusMarine.username,
            COPERNICUS_MARINE_PASSWORD: config.copernicusMarine.password,
            // copernicusmarine ≥2.x reads these canonical env var names
            COPERNICUSMARINE_SERVICE_USERNAME: config.copernicusMarine.username,
            COPERNICUSMARINE_SERVICE_PASSWORD: config.copernicusMarine.password,
          },
          maxBuffer: 1024 * 1024,
        },
        async (error, stdout) => {
          if (error) {
            return resolve(await fallback(`Marine query timeout or error: ${error.message}`));
          }

          try {
            const data = JSON.parse(stdout.trim());
            const unavailable =
              data.status === 'PROVIDER_NOT_CONFIGURED' || data.status !== 'SUCCESS';
            if (unavailable) {
              return resolve(await fallback(data.errorMessage || 'Copernicus Marine returned error status'));
            }

            resolve({
              timestamp: data.timestamp,
              latitude: data.latitude,
              longitude: data.longitude,
              current_u: data.u,
              current_v: data.v,
              currentSpeedKnots: data.speedKnots,
              currentDirectionDeg: data.directionDeg,
              source: 'Copernicus Marine Service',
              isLiveRealData: false,
              attribution: `Copernicus Marine ${data.dataset} current field.`,
              provenanceLabel: 'HISTORICAL DATA',
              status: 'SUCCESS',
            });
          } catch (parseError: any) {
            resolve(await fallback(`Could not parse marine.py output: ${parseError.message}`));
          }
        }
      );
    });
  }
}

export class WeatherDataProvider implements IWeatherDataProvider {
  public async getWind(lat: number, lon: number, timestamp: string): Promise<WeatherData> {
    const fallback = async (reason: string): Promise<WeatherData> => {
      console.warn(`[WeatherDataProvider] Primary ERA5 CDS query failed (${reason}); trying Open-Meteo ERA5 reanalysis fallback...`);
      try {
        const om = new OpenMeteoWeatherProvider();
        const res = await om.getWind(lat, lon, timestamp);
        if (res.status === 'SUCCESS') {
          return {
            ...res,
            attribution: `ERA5 Reanalysis 10m wind field (via Open-Meteo). Primary direct CDS query: ${reason}`,
          };
        }
      } catch (err: any) {
        console.warn(`[WeatherDataProvider] Open-Meteo ERA5 fallback failed: ${err.message}`);
      }
      return {
        timestamp,
        latitude: lat,
        longitude: lon,
        u10: null,
        v10: null,
        windSpeedKnots: null,
        windDirectionDeg: null,
        source: 'Copernicus Climate Change Service ERA5',
        isLiveRealData: false,
        attribution: `ERA5 data unavailable (${reason}).`,
        provenanceLabel: 'DATA UNAVAILABLE',
        status: 'DATA_UNAVAILABLE',
        errorMessage: reason,
      };
    };

    if (!config.era5.apiKey) {
      return await fallback('ERA5_API_KEY is not configured in server/.env');
    }

    return new Promise((resolve) => {
      const script = path.resolve(__dirname, '../../ml/era5.py');
      execFile(
        process.env.PYTHON_EXECUTABLE || 'python',
        [script, String(lat), String(lon), timestamp],
        {
          cwd: path.resolve(__dirname, '../../'),
          timeout: 15000,
          env: {
            ...process.env,
            ERA5_API_KEY: config.era5.apiKey,
            ERA5_CDS_URL: config.era5.cdsUrl || 'https://cds.climate.copernicus.eu/api',
          },
          maxBuffer: 1024 * 1024,
        },
        async (error, stdout) => {
          if (error) {
            return resolve(await fallback(`ERA5 script error or timeout: ${error.message}`));
          }

          try {
            const data = JSON.parse(stdout.trim());
            const errStatuses = [
              'PROVIDER_NOT_CONFIGURED',
              'LICENCE_NOT_ACCEPTED',
              'AUTH_FAILED',
              'DATA_UNAVAILABLE',
            ];
            if (errStatuses.includes(data.status) || data.status !== 'SUCCESS') {
              return resolve(await fallback(data.errorMessage || `ERA5 returned status ${data.status}`));
            }

            resolve({
              timestamp: data.timestamp,
              latitude: data.latitude,
              longitude: data.longitude,
              u10: data.u10,
              v10: data.v10,
              windSpeedKnots: data.windSpeedKnots,
              windDirectionDeg: data.windDirectionDeg,
              temperatureC: data.temperatureC ?? null,
              surfacePressureHpa: data.surfacePressureHpa ?? null,
              totalPrecipitationMm: data.totalPrecipitationMm ?? null,
              cached: Boolean(data.cached),
              storagePath: data.storagePath,
              areaRequested: data.area_requested,
              source: 'Copernicus Climate Change Service ERA5',
              isLiveRealData: false,
              attribution: `ERA5 reanalysis wind from ${data.dataset || 'reanalysis-era5-single-levels'}${data.cached ? ' (local NetCDF cache)' : ''}.`,
              provenanceLabel: 'HISTORICAL REANALYSIS',
              status: 'SUCCESS',
            });
          } catch (parseError: any) {
            resolve(await fallback(`Could not parse ERA5 output: ${parseError.message}`));
          }
        }
      );
    });
  }
}

export class OpenMeteoWeatherProvider implements IWeatherDataProvider {
  public async getWind(lat: number, lon: number, timestamp: string): Promise<WeatherData> {
    try {
      const dt = new Date(timestamp);
      if (isNaN(dt.getTime())) {
        return {
          timestamp,
          latitude: lat,
          longitude: lon,
          u10: null,
          v10: null,
          windSpeedKnots: null,
          windDirectionDeg: null,
          source: 'ECMWF ERA5 Atmospheric Reanalysis (via Open-Meteo)',
          isLiveRealData: false,
          attribution: 'Invalid timestamp format provided.',
          provenanceLabel: 'DATA UNAVAILABLE',
          status: 'DATA_UNAVAILABLE',
          errorMessage: 'Invalid timestamp',
        };
      }

      const dateStr = dt.toISOString().split('T')[0];
      const targetHour = dt.getUTCHours();
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=wind_speed_10m,wind_direction_10m`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`Open-Meteo ERA5 API returned HTTP ${response.status}`);
      }

      const json = (await response.json()) as any;
      const speeds = json.hourly?.wind_speed_10m;
      const directions = json.hourly?.wind_direction_10m;
      if (!Array.isArray(speeds) || speeds[targetHour] == null) {
        throw new Error('Open-Meteo returned no hourly wind data for the specified hour.');
      }

      const speedKmh = Number(speeds[targetHour]);
      const dirDeg = Number(directions[targetHour]);
      const speedKnots = parseFloat((speedKmh / 1.852).toFixed(2));
      const speedMs = speedKmh / 3.6;
      const dirRad = (dirDeg * Math.PI) / 180.0;
      const u10 = parseFloat((-speedMs * Math.sin(dirRad)).toFixed(3));
      const v10 = parseFloat((-speedMs * Math.cos(dirRad)).toFixed(3));

      return {
        timestamp: `${dateStr}T${String(targetHour).padStart(2, '0')}:00:00Z`,
        latitude: lat,
        longitude: lon,
        u10,
        v10,
        windSpeedKnots: speedKnots,
        windDirectionDeg: dirDeg,
        source: 'ECMWF ERA5 Atmospheric Reanalysis (via Open-Meteo)',
        isLiveRealData: true,
        attribution: 'Open-Meteo ERA5 Reanalysis 10m wind field.',
        provenanceLabel: 'HISTORICAL DATA',
        status: 'SUCCESS',
      };
    } catch (err: any) {
      return {
        timestamp,
        latitude: lat,
        longitude: lon,
        u10: null,
        v10: null,
        windSpeedKnots: null,
        windDirectionDeg: null,
        source: 'ECMWF ERA5 Atmospheric Reanalysis (via Open-Meteo)',
        isLiveRealData: false,
        attribution: 'Open-Meteo ERA5 request failed.',
        provenanceLabel: 'DATA UNAVAILABLE',
        status: 'DATA_UNAVAILABLE',
        errorMessage: err.message,
      };
    }
  }
}

export class OpenMeteoOceanProvider implements IOceanDataProvider {
  public async getCurrent(lat: number, lon: number, timestamp: string): Promise<OceanData> {
    try {
      const dt = new Date(timestamp);
      const dateStr = !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : '';
      const dateParams = dateStr ? `&start_date=${dateStr}&end_date=${dateStr}` : '';
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}${dateParams}&hourly=ocean_current_velocity,ocean_current_direction`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`Open-Meteo Marine API returned HTTP ${response.status}`);
      }

      const json = (await response.json()) as any;
      const times = json.hourly?.time;
      const velocities = json.hourly?.ocean_current_velocity;
      const directions = json.hourly?.ocean_current_direction;

      if (!Array.isArray(velocities) || velocities.length === 0) {
        throw new Error('Open-Meteo returned no ocean current data for these coordinates.');
      }

      let bestIdx = -1;
      let minDiff = Infinity;
      const targetTime = dt.getTime();
      for (let i = 0; i < times.length; i++) {
        if (velocities[i] == null || directions[i] == null) continue;
        const t = new Date(times[i] + ':00Z').getTime();
        const diff = Math.abs(t - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }

      // If no valid non-null entry exists or closest point is further than 24 hours, do not substitute
      if (bestIdx < 0 || minDiff > 24 * 3600 * 1000) {
        throw new Error(`No historical ocean current data available from Open-Meteo Marine for ${dateStr || timestamp}.`);
      }

      const rawVel = velocities[bestIdx];
      const rawDir = directions[bestIdx];
      if (rawVel == null || rawDir == null) {
        throw new Error(`Open-Meteo returned null current velocity/direction for ${dateStr || timestamp}.`);
      }

      const velKmh = Number(rawVel);
      const dirDeg = Number(rawDir);
      const speedKnots = parseFloat((velKmh / 1.852).toFixed(2));
      const velMs = velKmh / 3.6;
      const dirRad = (dirDeg * Math.PI) / 180.0;
      const current_u = parseFloat((velMs * Math.sin(dirRad)).toFixed(3));
      const current_v = parseFloat((velMs * Math.cos(dirRad)).toFixed(3));

      return {
        timestamp: times[bestIdx] ? `${times[bestIdx]}:00Z` : timestamp,
        latitude: lat,
        longitude: lon,
        current_u,
        current_v,
        currentSpeedKnots: speedKnots,
        currentDirectionDeg: dirDeg,
        source: 'Mercator Ocean / Copernicus Marine Physics (via Open-Meteo Marine)',
        isLiveRealData: true,
        attribution: 'Open-Meteo Marine surface current model.',
        provenanceLabel: 'HISTORICAL REANALYSIS',
        status: 'SUCCESS',
      };
    } catch (err: any) {
      return {
        timestamp,
        latitude: lat,
        longitude: lon,
        current_u: null,
        current_v: null,
        currentSpeedKnots: null,
        currentDirectionDeg: null,
        source: 'Mercator Ocean / Copernicus Marine Physics (via Open-Meteo Marine)',
        isLiveRealData: false,
        attribution: 'Open-Meteo Marine request failed.',
        provenanceLabel: 'DATA UNAVAILABLE',
        status: 'DATA_UNAVAILABLE',
        errorMessage: err.message,
      };
    }
  }
}

export class SatelliteDataProvider implements ISatelliteDataProvider {
  private async getAccessToken(): Promise<string> {
    const { clientId, clientSecret } = config.copernicusDataSpace;
    if (!clientId || !clientSecret) {
      throw new Error('Copernicus Data Space credentials are not configured.');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(
        'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        throw new Error(`CDSE OAuth failed with HTTP ${response.status}`);
      }
      const json = (await response.json()) as any;
      if (!json.access_token) {
        throw new Error('CDSE OAuth response did not contain access_token.');
      }
      return json.access_token;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async downloadProduct(
    productId: string,
    sceneId: string,
    incidentId: string,
    accessToken: string,
    aoiBox?: [number, number, number, number],
    referenceTime?: string,
    searchWindowHours = 48,
    acquisitionStart?: string,
    acquisitionEnd?: string
  ): Promise<string> {
    const storageDir = path.resolve(__dirname, '../../storage/sentinel1', incidentId);
    await fs.mkdir(storageDir, { recursive: true });
    const safeName = sceneId.replace(/[^A-Za-z0-9._-]/g, '_');
    const targetTiff = path.join(storageDir, `${safeName}.tif`);

    if (await fileExists(targetTiff)) {
      return targetTiff;
    }

    // Acquire authentic georeferenced 3-band SAR raster via Sentinel Hub Process API
    if (aoiBox && aoiBox.length === 4) {
      const [minLat, minLon, maxLat, maxLon] = aoiBox;
      const refDate = referenceTime ? new Date(referenceTime) : new Date();
      const fromTime = acquisitionStart
        ? new Date(new Date(acquisitionStart).getTime() - 60000).toISOString()
        : new Date(refDate.getTime() - searchWindowHours * 3600 * 1000).toISOString();
      const toTime = acquisitionEnd
        ? new Date(new Date(acquisitionEnd).getTime() + 60000).toISOString()
        : new Date(refDate.getTime() + searchWindowHours * 3600 * 1000).toISOString();

      const processUrl = 'https://sh.dataspace.copernicus.eu/api/v1/process';
      const processBody = {
        input: {
          bounds: {
            bbox: [minLon, minLat, maxLon, maxLat],
          },
          data: [
            {
              type: 'sentinel-1-grd',
              dataFilter: {
                timeRange: {
                  from: fromTime,
                  to: toTime,
                },
              },
            },
          ],
        },
        output: {
          width: 256,
          height: 256,
          responses: [
            {
              identifier: 'default',
              format: {
                type: 'image/tiff',
              },
            },
          ],
        },
        evalscript: `//VERSION=3
function setup() {
  return {
    input: ["VV", "VH"],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  var ratio = (sample.VV > 0 && sample.VH > 0) ? (sample.VH / sample.VV) : 0;
  return [sample.VV, sample.VH, ratio];
}
`,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(processUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'image/tiff',
          },
          body: JSON.stringify(processBody),
          signal: controller.signal,
        });

        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 1024) {
            await fs.writeFile(targetTiff, buffer);
            return targetTiff;
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`[SentinelHub Process API] HTTP ${response.status}: ${errText}`);
        }
      } catch (err: any) {
        console.warn(`[SentinelHub Process API] Request exception: ${err.message}`);
        // Fall back to catalogue download
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Fallback attempt via catalogue $value
    const targetZip = path.join(storageDir, `${safeName}.zip`);
    const url = `https://catalogue.dataspace.copernicus.eu/odata/v1/Products(${encodeURIComponent(productId)})/$value`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`CDSE product download failed with HTTP ${response.status}`);
      }

      const file = await fs.open(targetZip, 'w');
      try {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await file.write(value);
        }
      } finally {
        await file.close();
      }

      const stat = await fs.stat(targetZip);
      if (stat.size < 1024) {
        await fs.rm(targetZip, { force: true });
        throw new Error('Downloaded Sentinel-1 product is unexpectedly small/incomplete.');
      }
      return targetZip;
    } catch (error) {
      await fs.rm(targetZip, { force: true });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async getObservation(
    incidentId: string,
    aoiBox: [number, number, number, number],
    referenceTime?: string,
    searchWindowHours = 48
  ): Promise<SatelliteObservationData> {
    const [minLat, minLon, maxLat, maxLon] = aoiBox;

    // Sentinel-1A launched 2014-04-03. No imagery exists before this date.
    const SENTINEL1_LAUNCH = new Date('2014-04-03T00:00:00Z');
    if (referenceTime) {
      const refDate = new Date(referenceTime);
      if (!isNaN(refDate.getTime()) && refDate < SENTINEL1_LAUNCH) {
        return {
          provider: 'Copernicus Data Space Ecosystem',
          sceneId: '',
          satellite: 'Sentinel-1',
          sensor: 'C-SAR',
          polarization: 'UNKNOWN',
          acquisitionTime: referenceTime,
          resolutionMeters: 10,
          incidenceAngleDeg: 0,
          orbitNumber: 0,
          direction: 'UNKNOWN',
          productType: 'GRD',
          source: 'Copernicus Data Space Ecosystem',
          isLiveRealData: false,
          provenanceLabel: 'DATA UNAVAILABLE',
          status: 'NO_MATCHING_SCENE',
          errorMessage: `Sentinel-1 was launched on 2014-04-03. No SAR imagery exists for the requested date (${refDate.toISOString().split('T')[0]}). This is not a system error — C-band SAR coverage simply does not exist for this historical date.`,
        };
      }
    }

    const hasCredentials = Boolean(
      config.copernicusDataSpace.clientId && config.copernicusDataSpace.clientSecret
    );

    if (!hasCredentials) {
      return {
        provider: 'Copernicus Data Space Ecosystem',
        sceneId: '',
        satellite: 'Sentinel-1',
        sensor: 'C-SAR',
        polarization: 'UNKNOWN',
        acquisitionTime: referenceTime || new Date().toISOString(),
        resolutionMeters: 10,
        incidenceAngleDeg: 0,
        orbitNumber: 0,
        direction: 'UNKNOWN',
        productType: 'GRD',
        source: 'Copernicus Data Space Ecosystem',
        isLiveRealData: false,
        provenanceLabel: 'PROVIDER NOT CONFIGURED',
        status: 'PROVIDER_NOT_CONFIGURED',
        errorMessage: 'Copernicus Data Space credentials are not configured.',
      };
    }

    try {
      const token = await this.getAccessToken();
      const wktPolygon =
        `geography'SRID=4326;POLYGON((${minLon} ${minLat},${maxLon} ${minLat},` +
        `${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))'`;

      const refDate = referenceTime ? new Date(referenceTime) : new Date();
      const startTime = new Date(refDate.getTime() - searchWindowHours * 3600 * 1000).toISOString();
      const endTime = new Date(refDate.getTime() + searchWindowHours * 3600 * 1000).toISOString();

      const filterParts = [
        "Collection/Name eq 'SENTINEL-1'",
        "contains(Name,'GRD')",
        `OData.CSC.Intersects(area=${wktPolygon})`,
        `ContentDate/Start ge ${startTime}`,
        `ContentDate/Start le ${endTime}`,
      ];
      const url =
        `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?` +
        `$filter=${encodeURIComponent(filterParts.join(' and '))}` +
        `&$top=5&$orderby=ContentDate/Start desc`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`CDSE catalogue search failed with HTTP ${response.status}`);
      }

      const json = (await response.json()) as any;
      const products = Array.isArray(json.value) ? json.value : [];
      if (!products.length) {
        return {
          provider: 'Copernicus Data Space Ecosystem',
          sceneId: '',
          satellite: 'Sentinel-1',
          sensor: 'C-SAR',
          polarization: 'UNKNOWN',
          acquisitionTime: referenceTime || new Date().toISOString(),
          resolutionMeters: 10,
          incidenceAngleDeg: 0,
          orbitNumber: 0,
          direction: 'UNKNOWN',
          productType: 'GRD',
          source: 'Copernicus Data Space Ecosystem',
          isLiveRealData: false,
          provenanceLabel: 'DATA UNAVAILABLE',
          status: 'NO_MATCHING_SCENE',
          errorMessage: `No Sentinel-1 GRD product intersects the active AOI in the requested time window.`,
        };
      }

      const prod = products[0];
      const sceneId = String(prod.Name || prod.Id);
      const attrs = Array.isArray(prod.Attributes) ? prod.Attributes : [];
      const attr = (name: string) => attrs.find((a: any) => a.Name === name)?.Value;
      const polarization = attr('polarisationChannels') || 'UNKNOWN';
      const orbitNumber = Number(attr('orbitNumber') ?? 0) || 0;
      const orbitDirection = attr('orbitDirection') || 'UNKNOWN';
      const satellite = sceneId.startsWith('S1B') ? 'Sentinel-1B' : 'Sentinel-1A';

      let localProductPath: string;
      try {
        localProductPath = await this.downloadProduct(
          String(prod.Id),
          sceneId,
          incidentId,
          token,
          aoiBox,
          referenceTime,
          searchWindowHours,
          prod.ContentDate?.Start,
          prod.ContentDate?.End
        );
      } catch (downloadError: any) {
        return {
          provider: 'Copernicus Data Space Ecosystem',
          productId: String(prod.Id),
          sceneId,
          satellite,
          platform: satellite,
          mission: 'Copernicus Sentinel-1',
          sensor: 'C-SAR (5.405 GHz)',
          polarization,
          acquisitionTime: prod.ContentDate?.Start || referenceTime || new Date().toISOString(),
          acquisitionStart: prod.ContentDate?.Start,
          acquisitionEnd: prod.ContentDate?.End,
          resolutionMeters: 10,
          incidenceAngleDeg: 0,
          orbitNumber,
          direction: orbitDirection,
          productType: 'GRD',
          processingLevel: 'LEVEL-1',
          footprintWkt: prod.Footprint,
          bbox: aoiBox,
          downloadUrl: `https://catalogue.dataspace.copernicus.eu/odata/v1/Products(${prod.Id})/$value`,
          source: 'Copernicus Data Space Ecosystem (Sentinel-1 C-SAR)',
          isLiveRealData: false,
          provenanceLabel: 'DATA UNAVAILABLE',
          status: 'DATA_UNAVAILABLE',
          errorMessage: `Sentinel-1 catalogue search succeeded but authenticated product download failed: ${downloadError.message}`,
        };
      }

      return {
        provider: 'Copernicus Data Space Ecosystem',
        productId: String(prod.Id),
        sceneId,
        satellite,
        platform: satellite,
        mission: 'Copernicus Sentinel-1',
        sensor: 'C-SAR (5.405 GHz)',
        polarization,
        acquisitionTime: prod.ContentDate?.Start || referenceTime || new Date().toISOString(),
        acquisitionStart: prod.ContentDate?.Start,
        acquisitionEnd: prod.ContentDate?.End,
        resolutionMeters: 10,
        incidenceAngleDeg: Number(attr('incidenceAngle') ?? 0) || 0,
        orbitNumber,
        direction: orbitDirection,
        productType: 'GRD',
        processingLevel: 'LEVEL-1',
        footprintWkt: prod.Footprint,
        bbox: aoiBox,
        downloadUrl: `https://catalogue.dataspace.copernicus.eu/odata/v1/Products(${prod.Id})/$value`,
        localProductPath,
        source: 'Copernicus Data Space Ecosystem (Sentinel-1 C-SAR)',
        isLiveRealData: true,
        provenanceLabel: 'LIVE / REAL DATA',
        status: 'SUCCESS',
      };
    } catch (error: any) {
      return {
        provider: 'Copernicus Data Space Ecosystem',
        sceneId: '',
        satellite: 'Sentinel-1',
        sensor: 'C-SAR',
        polarization: 'UNKNOWN',
        acquisitionTime: referenceTime || new Date().toISOString(),
        resolutionMeters: 10,
        incidenceAngleDeg: 0,
        orbitNumber: 0,
        direction: 'UNKNOWN',
        productType: 'GRD',
        source: 'Copernicus Data Space Ecosystem',
        isLiveRealData: false,
        provenanceLabel: 'DATA UNAVAILABLE',
        status: 'DATA_UNAVAILABLE',
        errorMessage: error.message || 'Copernicus Data Space operation failed.',
      };
    }
  }

  public async searchProducts(params: {
    bbox: [number, number, number, number];
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<SatelliteSearchResult> {
    const { bbox, startDate, endDate, limit = 10 } = params;
    const [minLat, minLon, maxLat, maxLon] = bbox;
    const hasCredentials = Boolean(
      config.copernicusDataSpace.clientId && config.copernicusDataSpace.clientSecret
    );

    if (!hasCredentials) {
      return {
        providerConfigured: false,
        provider: 'Copernicus Data Space Ecosystem',
        status: 'PROVIDER_NOT_CONFIGURED',
        scenes: [],
        errorMessage: 'Copernicus Data Space credentials are not configured.',
      };
    }

    try {
      const token = await this.getAccessToken();
      const wktPolygon =
        `geography'SRID=4326;POLYGON((${minLon} ${minLat},${maxLon} ${minLat},` +
        `${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))'`;

      const startTime = new Date(startDate).toISOString();
      const endTime = new Date(endDate).toISOString();

      const filterParts = [
        "Collection/Name eq 'SENTINEL-1'",
        "contains(Name,'GRD')",
        `OData.CSC.Intersects(area=${wktPolygon})`,
        `ContentDate/Start ge ${startTime}`,
        `ContentDate/Start le ${endTime}`,
      ];
      const url =
        `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?` +
        `$filter=${encodeURIComponent(filterParts.join(' and '))}` +
        `&$top=${limit}&$orderby=ContentDate/Start desc`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`CDSE catalogue search failed with HTTP ${response.status}`);
      }

      const json = (await response.json()) as any;
      const products = Array.isArray(json.value) ? json.value : [];
      if (!products.length) {
        return {
          providerConfigured: true,
          provider: 'Copernicus Data Space Ecosystem',
          status: 'NO_MATCHING_SCENE',
          scenes: [],
          errorMessage: 'No Sentinel-1 GRD product found for the specified AOI and date range.',
        };
      }

      const scenes: SatelliteProductSummary[] = products.map((prod: any) => {
        const sceneId = String(prod.Name || prod.Id);
        const attrs = Array.isArray(prod.Attributes) ? prod.Attributes : [];
        const attr = (name: string) => attrs.find((a: any) => a.Name === name)?.Value;
        const polarization = attr('polarisationChannels') || 'VV + VH';
        const orbitNumber = Number(attr('orbitNumber') ?? 0) || 0;
        const orbitDirection = attr('orbitDirection') || 'DESCENDING';
        const satellite = sceneId.startsWith('S1B') ? 'Sentinel-1B' : 'Sentinel-1A';

        return {
          productId: String(prod.Id),
          sceneId,
          satellite,
          sensor: 'C-SAR (5.405 GHz)',
          polarization,
          acquisitionTime: prod.ContentDate?.Start || new Date().toISOString(),
          acquisitionStart: prod.ContentDate?.Start,
          acquisitionEnd: prod.ContentDate?.End,
          resolutionMeters: 10,
          orbitNumber,
          direction: orbitDirection,
          productType: 'GRD',
          footprintWkt: prod.Footprint,
          source: 'Copernicus Data Space Ecosystem (Sentinel-1 C-SAR)',
          status: 'VERIFIED ARCHIVE SCENE',
        };
      });

      return {
        providerConfigured: true,
        provider: 'Copernicus Data Space Ecosystem',
        status: 'SUCCESS',
        scenes,
      };
    } catch (err: any) {
      return {
        providerConfigured: true,
        provider: 'Copernicus Data Space Ecosystem',
        status: 'ERROR',
        scenes: [],
        errorMessage: err.message || 'Satellite search query failed.',
      };
    }
  }
}


async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
