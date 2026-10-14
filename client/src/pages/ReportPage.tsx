import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageShell from '../components/PageShell';
import ProvenanceBadge from '../components/ProvenanceBadge';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { DownloadIcon, ArrowLeftIcon, FileTextIcon } from 'lucide-react';

export default function ReportPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    api.report(code)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [code]);

  if (loading) return (
    <PageShell code={code} showProgress>
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[11px] font-mono tracking-widest text-[#9B9891] animate-pulse">COMPILING FORMAL DOSSIER...</div>
      </div>
    </PageShell>
  );

  if (!data || !data.dossier) return (
    <PageShell code={code} showProgress>
      <div className="pt-20">
        <EmptyState
          title="DOSSIER UNAVAILABLE"
          message="Investigation dossier could not be compiled. Ensure previous stages have completed."
        />
      </div>
    </PageShell>
  );

  const dossier = data.dossier;
  const topCandidate = dossier?.candidateAttribution?.[0];
  const sat = dossier?.satelliteEvidence;
  const origin = dossier?.hydrodynamics?.origin;
  const drift = dossier?.hydrodynamics?.drift;

  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen pb-32">
        {/* Dossier Header (Document Unfolding) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="px-8 pt-12 pb-10 border-b border-[#141414] bg-[#080808]"
        >
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="text-[10px] font-mono tracking-[0.4em] text-[#E85D04] uppercase mb-3 flex items-center gap-2">
                <FileTextIcon size={13} />
                <span>MARITIME INTELLIGENCE INVESTIGATION DOSSIER</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black font-mono text-[#F5F2EA] mb-2">
                AEGIS INVESTIGATION DOSSIER
              </h1>
              <div className="text-xs font-mono text-[#66635D]">
                REPORT ID: {data.reportNumber} · CLASSIFICATION: FORMAL TECHNICAL RECORD
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="btn-ghost text-xs flex items-center gap-2 py-2.5 font-mono"
              >
                <DownloadIcon size={14} className="text-[#E85D04]" />
                <span>EXPORT DOSSIER</span>
              </button>
            </div>
          </div>
        </motion.div>

        <div className="px-8 py-12 max-w-4xl mx-auto space-y-16">
          {/* 1. INVESTIGATION SUMMARY */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5 }}
          >
            <div className="section-label mb-3">01 / EXECUTIVE SUMMARY</div>
            <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono text-xs leading-relaxed text-[#9B9891]">
              {data.executiveSummary}
            </div>
          </motion.section>

          {/* 2. OBSERVATION */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="border-t border-[#141414] pt-10"
          >
            <div className="section-label mb-3">02 / OBSERVATION OVERVIEW</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
                <div className="text-[9px] text-[#555] uppercase">INVESTIGATION CODE</div>
                <div className="text-[#E85D04] font-bold mt-1">{code}</div>
              </div>
              <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
                <div className="text-[9px] text-[#555] uppercase">AOI SECTOR</div>
                <div className="text-[#F5F2EA] mt-1">{dossier.incidentSummary?.aoi || 'Arabian Sea Sector 4'}</div>
              </div>
              <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
                <div className="text-[9px] text-[#555] uppercase">OBSERVATION TIME</div>
                <div className="text-[#9B9891] mt-1">{new Date(data.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
              </div>
              <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
                <div className="text-[9px] text-[#555] uppercase">STATUS</div>
                <div className="text-[#4ade80] mt-1">{data.status}</div>
              </div>
            </div>
          </motion.section>

          {/* 3. SATELLITE EVIDENCE */}
          {sat && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="border-t border-[#141414] pt-10"
            >
              <div className="section-label mb-3">03 / SATELLITE EVIDENCE</div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono text-xs">
                <div className="flex items-center gap-2 mb-4">
                  <ProvenanceBadge label={sat.provenanceLabel || 'SATELLITE SAR OBSERVATION'} />
                  {sat.isDemoAsset && (
                    <span className="text-[9px] font-mono text-[#c084fc] border border-[#c084fc]/30 bg-[#c084fc]/5 px-2 py-0.5">DEMO REFERENCE ASSET · North Sea OSC-093-B</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">SATELLITE</div>
                    <div className="text-[#F5F2EA] mt-1">{sat.satellite}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">SCENE ID</div>
                    <div className="text-[#9B9891] mt-1 truncate" title={sat.sceneId}>{sat.sceneId}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">RESOLUTION</div>
                    <div className="text-[#9B9891] mt-1">{sat.resolution} m</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">ACQUISITION TIME</div>
                    <div className="text-[#9B9891] mt-1">{new Date(sat.acquisitionTime).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* 4. SPILL ANALYSIS */}
          {sat && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="border-t border-[#141414] pt-10"
            >
              <div className="section-label mb-3">04 / SPILL ANALYSIS</div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono text-xs">
                <div className="flex items-center gap-2 mb-4">
                  <ProvenanceBadge label="MODEL OUTPUT" />
                  <span className="text-[#555]">U-Net Segmentation Architecture</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">DELINEATED AREA</div>
                    {sat.slickAreaKm2 != null ? (
                      <div className="text-lg font-bold text-[#E85D04] mt-1">{sat.slickAreaKm2} km²</div>
                    ) : (
                      <div className="text-xs font-bold text-[#ef4444] mt-1">DATA UNAVAILABLE</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">ESTIMATED THICKNESS</div>
                    {sat.slickThicknessMinMaxMicrons != null ? (
                      <div className="text-[#9B9891] mt-1">{sat.slickThicknessMinMaxMicrons[0]}–{sat.slickThicknessMinMaxMicrons[1]} µm</div>
                    ) : (
                      <div>
                        <div className="text-[#ef4444] mt-1 text-xs font-bold">DATA UNAVAILABLE</div>
                        <div className="text-[9px] text-[#555] mt-0.5">{sat.thicknessNote}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] text-[#555] uppercase">MODEL ENGINE</div>
                    <div className="text-[#9B9891] mt-1">{sat.modelArchitecture || 'UNetSAR'}</div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* 5. ORIGIN & DRIFT */}
          {(origin || drift) && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="border-t border-[#141414] pt-10"
            >
              <div className="section-label mb-3">05 / ORIGIN & DRIFT ANALYSIS</div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono text-xs">
                <div className="flex items-center gap-2 mb-4">
                  <ProvenanceBadge label="DERIVED / COMPUTED" />
                  <span className="text-[#555]">Lagrangian Reverse Transport</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {origin && (
                    <>
                      <div>
                        <div className="text-[9px] text-[#555] uppercase">ORIGIN COORDINATES</div>
                        <div className="text-[#F5F2EA] mt-1">{origin.lat.toFixed(4)}°N, {origin.lon.toFixed(4)}°E</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#555] uppercase">PROBABILITY</div>
                        <div className="text-[#E85D04] font-bold mt-1">{origin.probabilityPercent != null ? `${origin.probabilityPercent}%` : 'DATA UNAVAILABLE'}</div>
                      </div>
                    </>
                  )}
                  {drift && (
                    <>
                      <div>
                        <div className="text-[9px] text-[#555] uppercase">NET DRIFT SPEED</div>
                        <div className="text-[#9B9891] mt-1">{drift.netSpeedKnots} kn @ {drift.netDirectionDeg}°</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#555] uppercase">COAST THREAT</div>
                        <div className="text-[#9B9891] mt-1">{drift.coastlineThreat}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* 6. AIS CORRELATION & FORENSIC FINDINGS */}
          {topCandidate && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="border-t border-[#141414] pt-10"
            >
              <div className="section-label mb-3">06 / AIS CORRELATION & FORENSIC FINDINGS</div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono text-xs">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[9px] text-[#555] uppercase tracking-widest mb-1">CANDIDATE RANK 1</div>
                    <div className="text-base font-bold text-[#F5F2EA]">{topCandidate.vesselName}</div>
                    <div className="text-[#66635D] text-[11px] mt-0.5">MMSI: {topCandidate.mmsi} · Type: {topCandidate.vesselType}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#E85D04]">{topCandidate.overallScore} / 100</div>
                    <div className="text-[9px] text-[#555] uppercase">ATTRIBUTION SCORE</div>
                  </div>
                </div>
                <p className="text-[#9B9891] leading-relaxed border-l border-[#333] pl-3">
                  {topCandidate.narrative}
                </p>
              </div>
            </motion.section>
          )}

          {/* 7. DATA PROVENANCE */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="border-t border-[#141414] pt-10"
          >
            <div className="section-label mb-3">07 / VERIFIABLE DATA PROVENANCE</div>
            <div className="border border-[#1f1f1f] bg-[#0a0a0a] p-6 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(dossier?.dataProvenance || {}).map(([k, v]: any) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[#E85D04] uppercase tracking-wider flex-shrink-0">
                      {k.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-[#66635D]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Return to Command Center Action */}
          <div className="pt-8 border-t border-[#1a1a1a] flex justify-between items-center font-mono">
            <button
              onClick={() => navigate(`/investigation/${code}/command`)}
              className="btn-ghost text-xs py-3 px-6 flex items-center gap-2"
            >
              <ArrowLeftIcon size={14} />
              <span>RETURN TO COMMAND CENTER</span>
            </button>
            <div className="text-[10px] text-[#555]">
              Formal investigation record sealed
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
