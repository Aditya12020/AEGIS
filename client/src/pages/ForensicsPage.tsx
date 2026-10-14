import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList
} from 'recharts';
import PageShell from '../components/PageShell';
import ProvenanceBadge from '../components/ProvenanceBadge';
import Drawer from '../components/Drawer';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { InfoIcon, ChevronRightIcon, BarChart3Icon } from 'lucide-react';

// Custom Tooltip adhering strictly to AEGIS black/orange/white visual system
const ForensicChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-[#0e0e0e] border border-[#333] px-4 py-3 shadow-2xl font-mono text-left pointer-events-none min-w-[200px]">
        <div className="text-xs font-bold text-[#F5F2EA] tracking-wide mb-1 border-b border-[#222] pb-1.5">
          {item.name}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <span className="text-[10px] text-[#9B9891] uppercase tracking-wider">Attribution Score:</span>
          <span className="text-base font-black text-[#E85D04] font-mono">
            {item.score}
            <span className="text-[10px] text-[#555] font-normal ml-0.5">/ 100</span>
          </span>
        </div>
        <div className="text-[9px] text-[#666] mt-2 uppercase tracking-widest pt-1 border-t border-[#1a1a1a]">
          Candidate Ranking Only
        </div>
      </div>
    );
  }
  return null;
};

// Custom Bar Value Label rendering exact score clearly to the right of each bar
const RenderCustomBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === undefined || value === null) return null;
  return (
    <text
      x={x + width + 14}
      y={y + height / 2 + 4}
      fill="#F5F2EA"
      textAnchor="start"
      fontSize={13}
      fontFamily="JetBrains Mono, monospace"
      fontWeight={700}
    >
      {value}
    </text>
  );
};

export default function ForensicsPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!code) return;
    api.suspects(code)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [code]);

  if (loading) return (
    <PageShell code={code} showProgress>
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[11px] font-mono tracking-widest text-[#9B9891] animate-pulse">LOADING ATTRIBUTION...</div>
      </div>
    </PageShell>
  );

  if (!data || !data.suspects || data.suspects.length === 0) return (
    <PageShell code={code} showProgress>
      <div className="pt-16 max-w-4xl mx-auto px-6 space-y-8">
        <EmptyState
          title="NO FORENSIC CANDIDATES CONVERGED"
          message="No candidate vessels were scored or telemetry records did not intersect the discharge corridor for this investigation AOI."
        />
        <div className="border-t border-[#1a1a1a] pt-6 flex justify-between items-center font-mono">
          <span className="text-xs text-[#555]">
            Review compiled multi-source intelligence evidence in formal dossier
          </span>
          <button
            onClick={() => navigate(`/investigation/${code}/report`)}
            className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
          >
            <span>VIEW FINAL DOSSIER</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </PageShell>
  );

  const suspects = data.suspects;
  const selected = suspects[selectedIdx];
  const chartData = data.comparisonChart?.slice(0, 5) || [];

  // Consistent analytical industrial coloring without claiming certainty
  const barFillColor = '#E85D04';

  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen max-w-7xl mx-auto px-6 space-y-12 py-8 pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-[#141414] pb-6 flex items-end justify-between"
        >
          <div>
            <div className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase mb-2">STAGE 06 · FORENSIC ATTRIBUTION</div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#F5F2EA]">Candidate Attribution Forensics</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <ProvenanceBadge label="MODEL OUTPUT / COMPUTED" />
              <span className="text-[#9B9891] text-[11px] font-mono border-l border-[#222] pl-3">
                Statistical correlation matrix · Candidate ranking only · Does not imply legal liability
              </span>
            </div>
          </div>
          {selected && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="btn-ghost text-xs flex items-center gap-2 py-2"
            >
              <InfoIcon size={13} className="text-[#E85D04]" />
              <span>VIEW FORENSIC DETAILS</span>
            </button>
          )}
        </motion.div>

        {/* Candidate Attribution Comparison Chart - Large, Dominant Analytical Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="border border-[#1f1f1f] bg-[#090909] p-7 md:p-8 space-y-6 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a1a1a] pb-4">
            <div className="flex items-center gap-2.5">
              <BarChart3Icon size={16} className="text-[#E85D04]" />
              <div className="text-sm font-bold font-mono text-[#F5F2EA] uppercase tracking-wider">
                Candidate Attribution Comparison
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#9B9891] uppercase px-2 py-0.5 border border-[#222] bg-[#050505]">
                CANDIDATE RANKING ONLY
              </span>
              <span className="text-[10px] font-mono tracking-widest text-[#555] uppercase hidden md:inline">
                TOP 5 CORRELATED VESSELS
              </span>
            </div>
          </div>

          {/* Spacious Horizontal Bar Chart with exact values and clear labels */}
          <div className="w-full h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 15, right: 65, left: 15, bottom: 15 }}
              >
                <CartesianGrid stroke="#161616" strokeDasharray="2 2" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fill: '#555', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#222' }}
                  tickLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fill: '#F5F2EA', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
                  axisLine={{ stroke: '#1f1f1f' }}
                  tickLine={false}
                />
                <Tooltip
                  content={<ForensicChartTooltip />}
                  cursor={{ fill: 'rgba(232, 93, 4, 0.05)' }}
                  allowEscapeViewBox={{ x: false, y: false }}
                />
                <Bar
                  dataKey="score"
                  name="Attribution Score"
                  fill={barFillColor}
                  barSize={26}
                  radius={[0, 2, 2, 0]}
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  <LabelList content={<RenderCustomBarLabel />} />
                  {chartData.map((_entry: any, idx: number) => (
                    <Cell
                      key={idx}
                      fill={barFillColor}
                      fillOpacity={0.88}
                      className="cursor-pointer hover:opacity-100 transition-opacity"
                      onClick={() => setSelectedIdx(idx)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#141414] text-[11px] font-mono text-[#555]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#E85D04] inline-block" />
              <span>Multi-criteria correlation index (trajectory + proximity + temporal window + AIS speed anomalies)</span>
            </div>
            <div>Values represent relative attribution probability, not legal culpability</div>
          </div>
        </motion.div>

        {/* Candidate Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 border border-[#1f1f1f]">
          {/* Candidate list */}
          <div className="border-r border-[#141414]">
            {suspects.slice(0, 5).map((s: any, idx: number) => (
              <button
                key={s.id}
                onClick={() => setSelectedIdx(idx)}
                className={`w-full text-left px-6 py-5 border-b border-[#141414] transition-colors ${
                  idx === selectedIdx ? 'bg-[#E85D04]/6' : 'hover:bg-[#0f0f0f]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono tracking-widest uppercase ${idx === selectedIdx ? 'text-[#E85D04]' : 'text-[#555]'}`}>{`CANDIDATE ${s.rank}`}</span>
                  <span className="font-bold font-mono text-sm text-[#F5F2EA]">
                    {s.overallScore} / 100
                  </span>
                </div>
                <div className="font-medium text-[#F5F2EA] text-sm">{s.vesselName}</div>
                <div className="text-[10px] font-mono text-[#555] mt-0.5">{s.mmsi} · {s.vesselType}</div>
              </button>
            ))}
          </div>

          {/* Selected Candidate Detail */}
          {selected && (
            <div className="lg:col-span-2 px-8 py-8 bg-[#0c0c0c]">
              <div className="mb-6">
                <div className="text-[10px] font-mono tracking-widest text-[#E85D04] uppercase mb-1">
                  CANDIDATE — RANK {selected.rank}
                </div>
                <h2 className="text-xl font-bold text-[#F5F2EA]">{selected.vesselName}</h2>
                <div className="text-[#66635D] text-xs font-mono mt-1">
                  MMSI: {selected.mmsi} · Type: {selected.vesselType} · Flag: {selected.flag || 'Unknown'}
                </div>
              </div>

              {/* Genuine Evaluated Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { label: 'Overall Attribution Score', value: selected.overallScore },
                  { label: 'Spatial Proximity Match', value: selected.proximityScore },
                  { label: 'Temporal Window Alignment', value: selected.timeMatchScore },
                  { label: 'Corridor Trajectory Correlation', value: selected.trajectoryScore },
                  { label: 'Speed Anomaly Score', value: selected.speedAnomalyScore },
                  { label: 'Route Deviation Score', value: selected.routeDeviationScore },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1 font-mono">
                      <span className="text-[10px] text-[#555] uppercase tracking-widest">{item.label}</span>
                      <span className="text-xs font-bold text-[#F5F2EA]">{item.value}</span>
                    </div>
                    <div className="h-1 bg-[#1a1a1a]">
                      <div className="h-full bg-[#E85D04]" style={{ width: item.value + '%' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Narrative */}
              <div className="border border-[#1f1f1f] bg-[#0a0a0a] p-5 mb-6 font-mono">
                <div className="section-label mb-2">Attribution Narrative</div>
                <p className="text-[#9B9891] text-xs leading-relaxed">{selected.narrative}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Progression CTA */}
        <div className="pt-8 border-t border-[#1a1a1a] flex justify-between items-center font-mono">
          <div className="text-xs text-[#555]">
            Evidence layer 06 verified · Advance to final formal dossier
          </div>
          <button
            onClick={() => navigate(`/investigation/${code}/report`)}
            className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
          >
            <span>CONTINUE TO DOSSIER / REPORT</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>

        {/* Drawer */}
        {selected && (
          <Drawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="EVIDENCE DOSSIER"
            subtitle={selected.vesselName}
            badge="ATTRIBUTION"
          >
            <div className="space-y-4">
              {(selected.evidence || []).map((e: any, idx: number) => (
                <div key={idx} className="border border-[#1f1f1f] p-4 bg-[#0a0a0a] font-mono">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#E85D04] uppercase tracking-widest">{e.category}</span>
                    <span className="text-xs text-[#9B9891]">Impact: +{e.scoreImpact}</span>
                  </div>
                  <div className="text-sm text-[#F5F2EA] font-semibold mb-1">{e.title}</div>
                  <p className="text-xs text-[#66635D] leading-relaxed">{e.description}</p>
                  <div className="mt-2 text-[10px] text-[#444]">Provenance: {e.provenance}</div>
                </div>
              ))}
            </div>
          </Drawer>
        )}
      </div>
    </PageShell>
  );
}
