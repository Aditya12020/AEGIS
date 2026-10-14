export type EvidenceState =
  | 'LIVE / REAL DATA'
  | 'MODEL OUTPUT'
  | 'DERIVED / COMPUTED'
  | 'HISTORICAL DATA'
  | 'HISTORICAL REANALYSIS'
  | 'DEMO'
  | 'PROVIDER NOT CONFIGURED'
  | 'LICENCE NOT ACCEPTED'
  | 'AUTH FAILED'
  | 'DATA UNAVAILABLE';

export interface OceanData {
  timestamp: string;
  latitude: number;
  longitude: number;
  current_u: number | null;
  current_v: number | null;
  currentSpeedKnots: number | null;
  currentDirectionDeg: number | null;
  seaSurfaceTemperatureC?: number;
  source: string;
  isLiveRealData: boolean;
  attribution: string;
  provenanceLabel: EvidenceState;
  status: 'SUCCESS' | 'DATA_UNAVAILABLE' | 'PROVIDER_NOT_CONFIGURED';
  errorMessage?: string;
}

export interface WeatherData {
  timestamp: string;
  latitude: number;
  longitude: number;
  u10: number | null;
  v10: number | null;
  windSpeedKnots: number | null;
  windDirectionDeg: number | null;
  swellHeightMeters?: number;
  seaState?: number;
  temperatureC?: number | null;
  surfacePressureHpa?: number | null;
  totalPrecipitationMm?: number | null;
  cached?: boolean;
  storagePath?: string;
  areaRequested?: { north: number; west: number; south: number; east: number };
  source: string;
  isLiveRealData: boolean;
  attribution: string;
  provenanceLabel: EvidenceState;
  status: 'SUCCESS' | 'DATA_UNAVAILABLE' | 'PROVIDER_NOT_CONFIGURED' | 'LICENCE_NOT_ACCEPTED' | 'AUTH_FAILED';
  errorMessage?: string;
}

export interface SatelliteObservationData {
  provider: string;
  productId?: string;
  sceneId: string;
  satellite: string;
  platform?: string;
  mission?: string;
  sensor: string;
  polarization: string;
  acquisitionTime: string;
  acquisitionStart?: string;
  acquisitionEnd?: string;
  resolutionMeters: number;
  incidenceAngleDeg: number;
  orbitNumber: number;
  relativeOrbit?: number;
  direction: string;
  productType: string;
  processingLevel?: string;
  footprintWkt?: string;
  bbox?: [number, number, number, number]; // [minLat, minLon, maxLat, maxLon]
  downloadUrl?: string;
  localProductPath?: string;
  source: string;
  isLiveRealData: boolean;
  provenanceLabel: EvidenceState;
  status: 'SUCCESS' | 'NO_MATCHING_SCENE' | 'DATA_UNAVAILABLE' | 'PROVIDER_NOT_CONFIGURED';
  errorMessage?: string;
}

export interface IOceanDataProvider {
  getCurrent(lat: number, lon: number, timestamp: string): Promise<OceanData>;
}

export interface IWeatherDataProvider {
  getWind(lat: number, lon: number, timestamp: string): Promise<WeatherData>;
}

export interface SatelliteProductSummary {
  productId: string;
  sceneId: string;
  satellite: string;
  sensor: string;
  polarization: string;
  acquisitionTime: string;
  acquisitionStart?: string;
  acquisitionEnd?: string;
  resolutionMeters: number;
  orbitNumber: number;
  direction: string;
  productType: string;
  footprintWkt?: string;
  source: string;
  status: string;
}

export interface SatelliteSearchResult {
  providerConfigured: boolean;
  provider: string;
  status: 'SUCCESS' | 'NO_MATCHING_SCENE' | 'PROVIDER_NOT_CONFIGURED' | 'ERROR';
  scenes: SatelliteProductSummary[];
  errorMessage?: string;
}

export interface ISatelliteDataProvider {
  getObservation(
    incidentId: string,
    aoiBox: [number, number, number, number],
    referenceTime?: string,
    searchWindowHours?: number
  ): Promise<SatelliteObservationData>;
  searchProducts(params: {
    bbox: [number, number, number, number];
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<SatelliteSearchResult>;
}

