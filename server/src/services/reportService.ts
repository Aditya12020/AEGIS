import { prisma } from './db';

export class ReportService {
  public async generateDossier(incidentCode: string) {
    const incident = await prisma.incident.findUnique({
      where: { incidentCode },
      include: {
        satelliteObservations: {
          include: { spillObservations: true },
        },
        driftObservations: true,
        originEstimates: true,
        suspectAnalyses: {
          include: {
            vessel: true,
            evidenceList: true,
          },
          orderBy: { rank: 'asc' },
        },
        investigations: true,
      },
    });

    if (!incident) throw new Error(`Incident ${incidentCode} not found`);

    const topSuspect = incident.suspectAnalyses[0];
    const sat = incident.satelliteObservations[0];
    const spill = sat?.spillObservations[0];
    const drift = incident.driftObservations[0];
    const origin = incident.originEstimates[0];

    const reportNumber = `AEGIS-DOSSIER-${incidentCode}`;
    
    // Truthful summary reflecting actual data presence
    const satSummary = spill
      ? `Sentinel-1 SAR imagery delineated an oil slick of ${spill.areaKm2} km² at centroid ${spill.centroidLat.toFixed(4)}°N, ${spill.centroidLon.toFixed(4)}°E (${spill.provenanceLabel}).`
      : 'Sentinel-1 SAR imagery was not acquired or unavailable for this investigation AOI.';

    const originSummary = origin
      ? `Hydrodynamic Lagrangian advection resolved estimated discharge origin at ${origin.originLat.toFixed(4)}°N, ${origin.originLon.toFixed(4)}°E (Uncertainty radius: ${origin.uncertaintyRadiusKm} km).`
      : 'Reverse hydrodynamic backtrack is uncomputed or MetOcean data is unavailable.';

    const suspectSummary = topSuspect
      ? `AIS correlation identified candidate vessel ${topSuspect.vessel.vesselName} (MMSI: ${topSuspect.mmsi}) with an attribution candidate score of ${topSuspect.overallScore}/100 based on spatio-temporal convergence and telemetry patterns.`
      : 'No candidate vessels have converged or been scored for this incident AOI.';

    const executiveSummary = `Maritime Intelligence Forensic Investigation for Incident ${incidentCode} (${incident.name}). ${satSummary} ${originSummary} ${suspectSummary}`;

    const isDemoSat = sat?.source === 'DEMO_REFERENCE_ASSET';

    const dossierPayload = {
      incident: {
        code: incident.incidentCode,
        name: incident.name,
        aoi: incident.aoiName,
        detectionTime: incident.detectionTime,
        coordinates: [incident.centerLat, incident.centerLon],
      },
      satelliteEvidence: sat ? {
        sceneId: sat.sceneId,
        satellite: sat.satellite,
        sensor: sat.sensor,
        polarization: sat.polarization,
        acquisitionTime: sat.acquisitionTime,
        resolution: sat.resolutionMeters,
        productType: sat.productType,
        source: sat.source,
        isDemoAsset: isDemoSat,
        provenanceLabel: isDemoSat ? 'DEMO REFERENCE ASSET (North Sea OSC-093-B)' : 'LIVE / REAL DATA',
        slickAreaKm2: spill?.areaKm2 ?? null,
        slickThicknessMinMaxMicrons: (spill?.thicknessMinMicrons != null && spill.thicknessMinMicrons >= 0)
          ? [spill.thicknessMinMicrons, spill.thicknessMaxMicrons]
          : null,
        thicknessNote: 'C-band SAR intensity alone cannot resolve micrometric film thickness without multi-spectral optical or in-situ radiometry.',
        modelArchitecture: spill?.modelArchitecture ?? null,
      } : null,
      hydrodynamics: {
        drift: drift ? {
          netSpeedKnots: drift.netDriftSpeedKnots,
          netDirectionDeg: drift.netDriftDirectionDeg,
          currentKnots: drift.currentSpeedKnots,
          windKnots: drift.windSpeedKnots,
          coastlineThreat: drift.nearestCoastName,
          threatWindowHours: drift.threatWindowHours,
          provenance: drift.provenanceLabel,
        } : null,
        origin: origin ? {
          lat: origin.originLat,
          lon: origin.originLon,
          releaseWindow: [origin.releaseStartTime, origin.releaseEndTime],
          uncertaintyKm: origin.uncertaintyRadiusKm,
          probabilityPercent: origin.probabilityPercent,
          particles: origin.monteCarloParticles,
          depthMeters: (origin.depthMeters != null && origin.depthMeters >= 0) ? origin.depthMeters : null,
          methodology: origin.methodology,
          provenance: origin.provenanceLabel,
        } : null,
      },
      candidateAttribution: incident.suspectAnalyses.slice(0, 5).map((s) => ({
        rank: s.rank,
        mmsi: s.mmsi,
        vesselName: s.vessel.vesselName,
        vesselType: s.vessel.vesselType,
        flag: s.vessel.flag,
        overallScore: s.overallScore,
        closestApproachKm: (s.closestDistanceKm != null && s.closestDistanceKm >= 0) ? s.closestDistanceKm : null,
        speedDropKnots: s.speedDropKnots,
        telemetryGapMinutes: s.aisBlackoutMinutes,
        narrative: s.narrative,
        provenance: s.provenanceLabel,
        evidence: s.evidenceList.map((e) => ({
          category: e.category,
          title: e.title,
          description: e.description,
          scoreImpact: e.scoreImpact,
          provenance: e.provenance,
        })),
      })),
      dataProvenance: {
        aisSource: 'HISTORICAL AIS DATA — Indian Ocean region CSV archive (not live satellite/terrestrial AIS)',
        satelliteSource: isDemoSat ? 'Reference SAR Benchmark (North Sea Scene OSC-093-B)' : 'Copernicus Data Space Ecosystem (Sentinel-1 C-SAR GRD)',
        oceanSource: drift
          ? 'Copernicus Marine Physics Analysis (Global Ocean) — data acquired and used in computation'
          : 'Copernicus Marine Physics Analysis (Global Ocean) — DATA UNAVAILABLE or NOT USED in this investigation run',
        weatherSource: drift
          ? 'ECMWF ERA5 Atmospheric Reanalysis — data acquired and used in computation'
          : 'ECMWF ERA5 Atmospheric Reanalysis — DATA UNAVAILABLE or NOT USED in this investigation run',
        pipelineIntegrity: 'Multi-source observational and hydrodynamic forensic analysis. All sources, models, and evidence states explicitly badged with provenance tracking.',
        legalDisclaimer: 'Attribution scores reflect probabilistic algorithmic candidate correlation based on AIS reception and hydrodynamic backscatter. Scores do not constitute judicial proof of culpability or liability without physical sampling and verification.',
      },
    };

    // Upsert report record
    const report = await prisma.report.upsert({
      where: { reportNumber },
      create: {
        incidentId: incident.id,
        reportNumber,
        executiveSummary,
        legalDossierJson: JSON.stringify(dossierPayload),
        provenanceSummary: 'Copernicus SAR + AIS Trajectory + Hydrodynamic Backtrack',
        status: 'FINAL',
      },
      update: {
        executiveSummary,
        legalDossierJson: JSON.stringify(dossierPayload),
        generatedAt: new Date(),
      },
    });

    return report;
  }
}
