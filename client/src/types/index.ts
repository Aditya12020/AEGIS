export interface Incident {
  id: string;
  incidentCode: string;
  name: string;
  aoiName: string;
  centerLat: number;
  centerLon: number;
  minLat: number; maxLat: number; minLon: number; maxLon: number;
  detectionTime: string;
  status: string;
  createdAt: string;
  investigations: Investigation[];
  satelliteObservations: SatelliteObservation[];
  driftObservations: DriftObservation[];
  originEstimates: OriginEstimate[];
  suspectAnalyses: SuspectAnalysis[];
}

export interface Investigation {
  id: string;
  status: string;
  stage: string;
  totalVesselsAnalyzed: number;
  highPriorityCandidates: number;
  confidenceScore: number;
  startedAt: string;
  completedAt?: string;
}

export interface SatelliteObservation {
  id: string;
  sceneId: string;
  satellite: string;
  sensor: string;
  polarization: string;
  acquisitionTime: string;
  resolutionMeters: number;
  incidenceAngleDeg: number;
  orbitNumber: number;
  orbitDirection: string;
  productType: string;
  source: string;
  isLiveRealData: boolean;
  spillObservations: SpillObservation[];
}

export interface SpillObservation {
  areaKm2: number;
  confidencePercent: number;
  centroidLat: number;
  centroidLon: number;
  polygonGeoJson: any;
  thicknessMinMicrons: number;
  thicknessMaxMicrons: number;
  modelArchitecture: string;
  provenanceLabel: string;
  isModelOutput: boolean;
}

export interface DriftObservation {
  netDriftSpeedKnots: number;
  netDriftDirectionDeg: number;
  currentSpeedKnots: number;
  currentDirectionDeg: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  currentContributionPercent: number;
  windContributionPercent: number;
  projectionsJson: string;
  nearestCoastName?: string;
  nearestCoastDistKm?: number;
  threatWindowHours?: number;
  provenanceLabel: string;
}

export interface OriginEstimate {
  originLat: number;
  originLon: number;
  probabilityPercent: number;
  releaseStartTime: string;
  releaseEndTime: string;
  backwardDistanceKm: number;
  uncertaintyRadiusKm: number;
  monteCarloParticles: number;
  convergencePercent: number;
  methodology: string;
  provenanceLabel: string;
}

export interface SuspectAnalysis {
  id: string;
  mmsi: string;
  rank: number;
  overallScore: number;
  proximityScore: number;
  timeMatchScore: number;
  trajectoryScore: number;
  speedAnomalyScore: number;
  routeDeviationScore: number;
  closestDistanceKm: number;
  closestTime: string;
  timeDiffMinutes: number;
  speedDropKnots: number;
  aisBlackoutMinutes: number;
  narrative: string;
  provenanceLabel: string;
  vessel: { vesselName: string; vesselType: string; flag?: string };
  evidenceList: Evidence[];
}

export interface Evidence {
  id: string;
  category: string;
  title: string;
  description: string;
  scoreImpact: number;
  provenance: string;
}
