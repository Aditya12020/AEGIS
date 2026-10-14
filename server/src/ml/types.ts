export interface IOilSpillSegmentationService {
  segment(sceneId: string): Promise<{
    areaKm2: number;
    confidencePercent: number;
    centroidLat: number;
    centroidLon: number;
    polygonGeoJson: any;
    thicknessMinMicrons: number;
    thicknessMaxMicrons: number;
    provenanceLabel: string;
    modelArchitecture: string;
  }>;
}

export interface IOriginEstimationService {
  estimateOrigin(params: {
    spillLat: number;
    spillLon: number;
    detectionTime: string;
    driftSpeedKnots: number;
    driftDirectionDeg: number;
  }): Promise<{
    originLat: number;
    originLon: number;
    probabilityPercent: number;
    releaseStartTime: string;
    releaseEndTime: string;
    backwardDistanceKm: number;
    backwardBearingDeg: number;
    uncertaintyRadiusKm: number;
    methodology: string;
    corridorPoints: Array<{ lat: number; lon: number; prob: number; time: string }>;
  }>;
}

export interface IDriftAnalysisService {
  computeDrift(params: {
    lat: number;
    lon: number;
    currentSpeedKnots: number;
    currentDirectionDeg: number;
    windSpeedKnots: number;
    windDirectionDeg: number;
    leewayFactor?: number;
    detectionTime: string;
  }): Promise<{
    netSpeedKnots: number;
    netDirectionDeg: number;
    currentContributionPercent: number;
    windContributionPercent: number;
    projections: Array<{ hours: number; timestamp: string; lat: number; lon: number; areaKm2: number; distKm: number }>;
    nearestCoastName: string;
    nearestCoastDistKm: number;
    threatWindowHours: number;
    methodology: string;
  }>;
}
