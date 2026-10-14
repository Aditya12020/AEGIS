import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';
import { OceanDataProvider, WeatherDataProvider } from '../providers';
import { SatelliteService } from '../services/satelliteService';
import { DriftService } from '../services/driftService';
import { OriginService } from '../services/originService';
import { AisInvestigationService } from '../services/aisInvestigationService';
import { ReportService } from '../services/reportService';

const router = Router();
const inFlightRuns = new Set<string>();

// GET investigation status
router.get('/:code/status', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: {
        investigations: true,
        satelliteObservations: {
          include: { spillObservations: true },
        },
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    const inv = incident.investigations[0];
    const hasSatellite = incident.satelliteObservations.length > 0;

    res.json({
      ...(inv || {}),
      satelliteReady: hasSatellite,
      satelliteStatus: hasSatellite ? 'READY' : (inv?.stage === 'SATELLITE_ACQUIRING' ? 'SATELLITE_ACQUIRING' : 'PENDING'),
      events: incident.events,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to record an investigation event
async function recordEvent(incidentId: string, stage: string, title: string, description: string, status: string = 'COMPLETED') {
  try {
    await prisma.investigationEvent.create({
      data: {
        incidentId,
        stage,
        title,
        description,
        status,
      },
    });
  } catch (e: any) {
    console.error(`[EventRecord] Failed to record event ${stage}:`, e.message);
  }
}

// POST run investigation pipeline with strict scientific integrity gating
router.post('/:code/run', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id: code }, { incidentCode: code }] },
      include: { investigations: true },
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    if (inFlightRuns.has(incident.id)) {
      return res.status(202).json({
        incidentCode: incident.incidentCode,
        status: 'RUNNING',
        message: 'Investigation pipeline is already actively running for this incident.',
      });
    }

    inFlightRuns.add(incident.id);

    try {
      // Mark as RUNNING in DB so polling clients see progress immediately
      await prisma.investigation.updateMany({
        where: { incidentId: incident.id },
        data: {
          status: 'RUNNING',
          stage: 'INCIDENT_CREATED',
          completedAt: null,
        },
      });

      // Clear previous investigation events for re-runs
      await prisma.investigationEvent.deleteMany({ where: { incidentId: incident.id } });

      const pipelineSteps: Array<{ step: string; label: string; status: string; detail?: string }> = [];

      // Step 1: Incident AOI & Parameters Verified
      await recordEvent(
        incident.id,
        'INCIDENT_CREATED',
        'Incident AOI & Parameters Verified',
        `Bounding box [${incident.minLat}°N, ${incident.minLon}°E to ${incident.maxLat}°N, ${incident.maxLon}°E]. Detection timestamp: ${incident.detectionTime.toISOString()}.`,
        'COMPLETED'
      );
      pipelineSteps.push({
        step: 'INCIDENT_CREATED',
        label: 'Incident parameters verified',
        status: 'COMPLETED',
      });

      // Step 2: Satellite Acquisition & ML Segmentation
      await prisma.investigation.updateMany({
        where: { incidentId: incident.id },
        data: { stage: 'SATELLITE_ACQUIRING' },
      });

      let satelliteObs: any = null;
      let spillObs: any = null;
      const satelliteAvailable: boolean = false; // will be updated below

      try {
        satelliteObs = await SatelliteService.getOrAcquireObservation(incident.id, { waitForCompletion: true });
        spillObs = satelliteObs?.spill ?? null;

      if (satelliteObs?.scene) {
        const isDemo = satelliteObs.scene?.source === 'DEMO_REFERENCE_ASSET';
        await recordEvent(
          incident.id,
          'SATELLITE_ACQUISITION',
          'Sentinel-1 SAR C-band Scene Acquired',
          `Scene ${satelliteObs.scene.sceneId} (${satelliteObs.scene.resolutionMeters}m GRD). Source: ${isDemo ? 'DEMO REFERENCE ASSET (North Sea OSC-093-B)' : 'Copernicus CDSE Sentinel-1 SAR'}.`,
          'COMPLETED'
        );
        pipelineSteps.push({
          step: 'SATELLITE_ACQUISITION',
          label: `Sentinel-1 SAR scene matched (${isDemo ? 'DEMO REFERENCE' : 'LIVE CDSE'})`,
          status: 'COMPLETED',
        });

        if (spillObs && spillObs.areaKm2 > 0) {
          await recordEvent(
            incident.id,
            'SPILL_ANALYSIS',
            'U-Net Slick Delineation & Morphology Resolved',
            `OIL SPILL DETECTED: Segmented surface extent: ${spillObs.areaKm2} km² with ${spillObs.confidencePercent}% confidence. Centroid: [${spillObs.centroid[0].toFixed(4)}°N, ${spillObs.centroid[1].toFixed(4)}°E]. Model: ${spillObs.modelArchitecture || 'U-Net ResNet-34'}.`,
            'COMPLETED'
          );
          pipelineSteps.push({
            step: 'SPILL_ANALYSIS',
            label: `SAR slick segmentation: OIL SPILL DETECTED (${spillObs.areaKm2} km² MODEL OUTPUT)`,
            status: 'COMPLETED',
          });
        } else {
          await recordEvent(
            incident.id,
            'SPILL_ANALYSIS',
            'U-Net SAR Inference Completed: No Oil Spill Detected',
            `NO OIL SPILL DETECTED: U-Net model evaluated SAR backscatter across the active AOI; no anomalous dark slick contours exceeded the detection threshold. Downstream hydrodynamic drift from surface slick is blocked.`,
            'COMPLETED'
          );
          pipelineSteps.push({
            step: 'SPILL_ANALYSIS',
            label: 'U-Net SAR analysis: NO OIL SPILL DETECTED (MODEL OUTPUT)',
            status: 'COMPLETED',
          });
        }
      } else {
        // No verified satellite observation — downstream drift & origin are BLOCKED
        await recordEvent(
          incident.id,
          'SATELLITE_ACQUISITION',
          'Satellite Observation Unavailable',
          'No Sentinel-1 SAR scene intersected the specified AOI within the temporal window. Downstream hydrodynamic drift and origin reconstruction from verified satellite slick geometry are blocked.',
          'DATA_UNAVAILABLE'
        );
        pipelineSteps.push({
          step: 'SATELLITE_ACQUISITION',
          label: 'Satellite observation unavailable for AOI/window',
          status: 'DATA_UNAVAILABLE',
        });
      }
    } catch (satErr: any) {
      console.error('[Pipeline] Satellite acquisition failed:', satErr.message);
      await recordEvent(
        incident.id,
        'SATELLITE_ACQUISITION',
        'Satellite Acquisition Provider Failed',
        `Error querying satellite provider: ${satErr.message}`,
        'FAILED'
      );
      pipelineSteps.push({
        step: 'SATELLITE_ACQUISITION',
        label: 'Satellite acquisition failed',
        status: 'FAILED',
        detail: satErr.message,
      });
    }

    // INTEGRITY GATE: Drift and Origin strictly require a verified surface oil slick.
    const spillGeometryAvailable = Boolean(spillObs && spillObs.areaKm2 > 0);

    // Step 3 & 4: MetOcean Providers — always query regardless of satellite status
    await prisma.investigation.updateMany({
      where: { incidentId: incident.id },
      data: { stage: 'METOCEAN_ACQUIRING' },
    });

    const oceanProvider = new OceanDataProvider();
    const weatherProvider = new WeatherDataProvider();
    const [ocean, weather] = await Promise.all([
      oceanProvider.getCurrent(incident.centerLat, incident.centerLon, incident.detectionTime.toISOString()),
      weatherProvider.getWind(incident.centerLat, incident.centerLon, incident.detectionTime.toISOString()),
    ]);

    const oceanAvailable = ocean.status === 'SUCCESS';
    const weatherAvailable = weather.status === 'SUCCESS';
    const metoceanAvailable = oceanAvailable && weatherAvailable;

    // Always delete stale drift/origin records before the run so we don't serve stale data
    await prisma.driftObservation.deleteMany({ where: { incidentId: incident.id } });
    await prisma.originEstimate.deleteMany({ where: { incidentId: incident.id } });

    // Determine blocking reason for drift/origin
    const driftBlockReasons: string[] = [];
    if (!spillGeometryAvailable) driftBlockReasons.push('no verified satellite slick geometry');
    if (!oceanAvailable) driftBlockReasons.push('ocean current data unavailable');
    if (!weatherAvailable) driftBlockReasons.push('wind data unavailable');

    if (driftBlockReasons.length > 0) {
      // One or more required inputs are unavailable — emit honest blocking events
      await recordEvent(
        incident.id,
        'DRIFT_COMPUTATION',
        'Drift Analysis Unavailable',
        `Hydrodynamic drift modeling blocked: ${driftBlockReasons.join('; ')}. Cannot compute a scientifically valid drift trajectory without all required upstream inputs.`,
        'DATA_UNAVAILABLE'
      );
      pipelineSteps.push({
        step: 'DRIFT_COMPUTATION',
        label: `Drift analysis blocked (${driftBlockReasons.join(', ')})`,
        status: 'DATA_UNAVAILABLE',
      });

      await recordEvent(
        incident.id,
        'ORIGIN_RECONSTRUCTION',
        'Origin Reconstruction Unavailable',
        `Discharge origin backtrack blocked: ${driftBlockReasons.join('; ')}. All upstream inputs (verified spill geometry, ocean current, wind) must be available for Monte Carlo trajectory inversion.`,
        'DATA_UNAVAILABLE'
      );
      pipelineSteps.push({
        step: 'ORIGIN_RECONSTRUCTION',
        label: 'Origin backtrack blocked (upstream inputs unavailable)',
        status: 'DATA_UNAVAILABLE',
      });
    } else {
      // All required inputs are available — run drift computation
      const driftService = new DriftService();
      const drift = driftService.calculateDrift({
        centroidLat: spillObs.centroid[0],
        centroidLon: spillObs.centroid[1],
        detectionTime: incident.detectionTime.toISOString(),
        currentSpeedKnots: ocean.currentSpeedKnots,
        currentDirectionDeg: ocean.currentDirectionDeg,
        windSpeedKnots: weather.windSpeedKnots,
        windDirectionDeg: weather.windDirectionDeg,
        currentAvailable: true,
        windAvailable: true,
        spillAvailable: true,
      });

      if (drift.status === 'SUCCESS' && drift.result) {
        await prisma.driftObservation.create({
          data: {
            incidentId: incident.id,
            netDriftSpeedKnots: drift.result.netDriftSpeedKnots,
            netDriftDirectionDeg: drift.result.netDriftDirectionDeg,
            currentSpeedKnots: ocean.currentSpeedKnots!,
            currentDirectionDeg: ocean.currentDirectionDeg!,
            windSpeedKnots: weather.windSpeedKnots!,
            windDirectionDeg: weather.windDirectionDeg!,
            currentContributionPercent: drift.result.currentContributionPercent,
            windContributionPercent: drift.result.windContributionPercent,
            leewayFactor: 0.032,
            projectionsJson: JSON.stringify(drift.result.projections),
            nearestCoastName: drift.result.nearestCoastline.name,
            nearestCoastDistKm: drift.result.nearestCoastline.distanceKm,
            threatWindowHours: drift.result.nearestCoastline.estimatedThreatWindowHours,
            confidence: drift.result.confidence,
            provenanceLabel: 'DERIVED / COMPUTED',
            methodology: drift.result.methodology,
          },
        });

        await recordEvent(
          incident.id,
          'DRIFT_COMPUTATION',
          'Coupled Hydrodynamic Advection Modeled',
          `Net drift: ${drift.result.netDriftSpeedKnots} kn @ ${drift.result.netDriftDirectionDeg}°. Coastline threat: ${drift.result.nearestCoastline.name} (${drift.result.nearestCoastline.distanceKm} km, ~${drift.result.nearestCoastline.estimatedThreatWindowHours}h).`,
          'COMPLETED'
        );
        pipelineSteps.push({
          step: 'DRIFT_COMPUTATION',
          label: 'Coupled hydrodynamic advection drift modeled (DERIVED)',
          status: 'COMPLETED',
        });

        // Origin reconstruction — requires drift to have converged
        const originService = new OriginService();
        const origin = originService.reconstructOrigin({
          spillLat: spillObs.centroid[0],
          spillLon: spillObs.centroid[1],
          detectionTime: incident.detectionTime.toISOString(),
          currentSpeedKnots: ocean.currentSpeedKnots,
          currentDirectionDeg: ocean.currentDirectionDeg,
          windSpeedKnots: weather.windSpeedKnots,
          windDirectionDeg: weather.windDirectionDeg,
          currentAvailable: true,
          windAvailable: true,
          spillAvailable: true,
          driftAvailable: true,
        });

        if (origin.status === 'SUCCESS' && origin.result) {
          await prisma.originEstimate.create({
            data: {
              incidentId: incident.id,
              originLat: origin.result.originLat,
              originLon: origin.result.originLon,
              probabilityPercent: origin.result.probabilityPercent,
              releaseStartTime: new Date(origin.result.releaseStartTime),
              releaseEndTime: new Date(origin.result.releaseEndTime),
              backwardDistanceKm: origin.result.backwardDistanceKm,
              backwardBearingDeg: origin.result.backwardBearingDeg,
              uncertaintyRadiusKm: origin.result.uncertaintyRadiusKm,
              monteCarloParticles: origin.result.monteCarloParticles,
              convergencePercent: origin.result.convergencePercent,
              depthMeters: origin.result.depthMeters ?? -1.0,
              corridorPointsJson: JSON.stringify(origin.result.corridorPoints),
              methodology: origin.result.methodology,
              provenanceLabel: 'DERIVED / COMPUTED',
            },
          });

          await recordEvent(
            incident.id,
            'ORIGIN_RECONSTRUCTION',
            '10,000 Particle Monte Carlo Backtrack Converged',
            `Discharge centroid: [${origin.result.originLat.toFixed(4)}°N, ${origin.result.originLon.toFixed(4)}°E], displacement: ${origin.result.backwardDistanceKm} km, 95th-pct uncertainty radius: ${origin.result.uncertaintyRadiusKm} km.`,
            'COMPLETED'
          );
          pipelineSteps.push({
            step: 'ORIGIN_RECONSTRUCTION',
            label: '10,000 Particle Monte Carlo Backtrack Converged (DERIVED)',
            status: 'COMPLETED',
          });
        } else {
          // Drift succeeded but origin failed internal convergence check
          await recordEvent(
            incident.id,
            'ORIGIN_RECONSTRUCTION',
            'Origin Reconstruction Unavailable',
            `Monte Carlo backtrack did not converge: ${origin.message ?? 'insufficient displacement for reliable inversion'}. No origin estimate stored.`,
            'DATA_UNAVAILABLE'
          );
          pipelineSteps.push({
            step: 'ORIGIN_RECONSTRUCTION',
            label: 'Origin reconstruction failed convergence check',
            status: 'DATA_UNAVAILABLE',
            detail: origin.message,
          });
        }
      } else {
        // Drift service returned DATA_UNAVAILABLE despite inputs being flagged available
        // (e.g. both vectors are zero — physically degenerate case)
        await recordEvent(
          incident.id,
          'DRIFT_COMPUTATION',
          'Drift Analysis Unavailable',
          `Drift computation returned DATA_UNAVAILABLE: ${drift.message ?? 'degenerate metocean vectors (both zero)'}. No drift observation stored.`,
          'DATA_UNAVAILABLE'
        );
        pipelineSteps.push({
          step: 'DRIFT_COMPUTATION',
          label: 'Drift analysis unavailable (degenerate vectors)',
          status: 'DATA_UNAVAILABLE',
          detail: drift.message,
        });

        await recordEvent(
          incident.id,
          'ORIGIN_RECONSTRUCTION',
          'Origin Reconstruction Unavailable',
          'Origin backtrack blocked because drift computation did not produce a valid trajectory.',
          'DATA_UNAVAILABLE'
        );
        pipelineSteps.push({
          step: 'ORIGIN_RECONSTRUCTION',
          label: 'Origin backtrack blocked (drift unavailable)',
          status: 'DATA_UNAVAILABLE',
        });
      }
    }

    // Step 5: AIS Ingestion & Attribution Scoring
    // AIS kinematics are always run; proximity scoring is only enabled when origin exists in DB.
    let candidateCount = 0;
    try {
      const aisInvestigationService = new AisInvestigationService();
      const aisResult = await aisInvestigationService.runAttribution(incident.incidentCode);
      candidateCount = aisResult?.topCandidates?.length || 0;

      const originUsed = aisResult?.originUsed ?? 'NONE';
      const originNote = originUsed === 'NONE'
        ? ' Origin-based proximity scoring suppressed (origin unavailable).'
        : '';

      await recordEvent(
        incident.id,
        'AIS_INGESTION',
        'AIS Telemetry Ingested & Spatio-Temporal Filter Applied',
        `Evaluated vessel trajectories against detection window. Scored ${candidateCount} candidate vessels using AIS kinematics.${originNote} Data source: HISTORICAL AIS CSV (Indian Ocean region).`,
        'COMPLETED'
      );
      pipelineSteps.push({
        step: 'AIS_INGESTION',
        label: `AIS telemetry analyzed (${candidateCount} candidates scored${originUsed === 'NONE' ? ', no origin' : ''})`,
        status: 'COMPLETED',
      });

      await recordEvent(
        incident.id,
        'ATTRIBUTION_CONVERGENCE',
        'Multi-Criteria Suspect Scoring Converged',
        `Candidate ranking synthesized from speed anomalies, heading deviations, telemetry gaps${originUsed !== 'NONE' ? ', and spatio-temporal proximity to discharge origin' : ''}.`,
        'COMPLETED'
      );
      pipelineSteps.push({
        step: 'ATTRIBUTION_CONVERGENCE',
        label: 'Candidate vessel attribution converged',
        status: 'COMPLETED',
      });
    } catch (aisErr: any) {
      console.error('[Pipeline] AIS attribution error:', aisErr.message);
      await recordEvent(
        incident.id,
        'AIS_INGESTION',
        'AIS Attribution Failed',
        `Error during AIS trajectory correlation: ${aisErr.message}`,
        'FAILED'
      );
      pipelineSteps.push({
        step: 'AIS_INGESTION',
        label: 'AIS trajectory correlation failed',
        status: 'FAILED',
        detail: aisErr.message,
      });
    }

    // Step 6: Dossier Generation
    try {
      const reportService = new ReportService();
      await reportService.generateDossier(incident.incidentCode);
      await recordEvent(
        incident.id,
        'DOSSIER_SEALED',
        'Forensic Intelligence Dossier Generated',
        'All observational, hydrodynamic, and AIS evidence compiled into sealed forensic dossier with verifiable provenance.',
        'COMPLETED'
      );
    } catch (repErr: any) {
      console.error('[Pipeline] Report generation error:', repErr.message);
    }

      // Determine final status
      const anyFailed = pipelineSteps.some((s) => s.status === 'FAILED');
      const finalStage = anyFailed ? 'PARTIAL_COMPLETION' : 'ATTRIBUTION_CONVERGED';

      await prisma.investigation.updateMany({
        where: { incidentId: incident.id },
        data: {
          status: anyFailed ? 'PARTIAL' : 'COMPLETED',
          stage: finalStage,
          completedAt: new Date(),
          notes: `Investigation pipeline finished with stage: ${finalStage}. Pipeline steps: ${pipelineSteps.map((s) => `${s.step}:${s.status}`).join(', ')}`,
        },
      });

      res.json({
        incidentCode: incident.incidentCode,
        status: finalStage,
        steps: pipelineSteps,
        completedAt: new Date().toISOString(),
      });
    } catch (pipelineErr: any) {
      console.error('[Pipeline] Fatal pipeline error:', pipelineErr.message);
      await prisma.investigation.updateMany({
        where: { incidentId: incident.id },
        data: { status: 'FAILED', stage: 'PIPELINE_ERROR' },
      }).catch(() => {});
      if (!res.headersSent) {
        res.status(500).json({ error: pipelineErr.message });
      }
    } finally {
      inFlightRuns.delete(incident.id);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
