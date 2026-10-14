import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageShell from '../components/PageShell';
import ProvenanceBadge from '../components/ProvenanceBadge';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChevronRightIcon } from 'lucide-react';

export default function TimeMachinePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    api.timeMachine(code).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  if (loading) return (
    <PageShell code={code} showProgress>
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[11px] font-mono tracking-widest text-[#9B9891] animate-pulse">LOADING TEMPORAL DATA...</div>
      </div>
    </PageShell>
  );

  if (!data || !data.steps || data.steps.length === 0 || data.status === 'DATA_UNAVAILABLE') {
    return (
      <PageShell code={code} showProgress>
        <div className="pt-16 max-w-4xl mx-auto px-6 space-y-8">
          <EmptyState
            title={data?.status === 'DATA_UNAVAILABLE' ? 'TEMPORAL RECONSTRUCTION UNAVAILABLE' : 'NO OBSERVATION AVAILABLE'}
            message={data?.error || data?.message || 'No time-series data available for this incident.'}
          />
          <div className="border-t border-[#1a1a1a] pt-6 flex justify-between items-center font-mono">
            <span className="text-xs text-[#555]">
              Advance to hydrodynamic transport and drift modeling
            </span>
            <button
              onClick={() => navigate(`/investigation/${code}/origin-drift`)}
              className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
            >
              <span>PROCEED TO ORIGIN / DRIFT</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const steps = data.steps || [];
  const current = steps[selectedStep];
  const chartData = data.spillAreaChart || [];

  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen max-w-6xl mx-auto px-6 space-y-24 py-12 pb-32">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#E85D04]" />
            <span className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">STAGE 03 · TEMPORAL EVOLUTION</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-[#F5F2EA] tracking-tight">Spill Time Machine</h1>
          <p className="text-sm font-mono text-[#9B9891]">Chronological observation timeline tracking surface slick expansion and advective displacement.</p>
        </motion.div>

        {/* TIMELINE CARDS */}
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false }} className="space-y-4">
          <div className="text-[10px] font-mono text-[#E85D04] uppercase tracking-widest">TEMPORAL OBSERVATION NODES</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step: any, idx: number) => {
              const isSelected = selectedStep === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedStep(idx)}
                  className={`p-5 text-left border transition-all font-mono ${
                    isSelected ? 'border-[#E85D04] bg-[#E85D04]/5' : 'border-[#1f1f1f] bg-[#0c0c0c] hover:border-[#333]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] uppercase tracking-widest ${isSelected ? 'text-[#E85D04]' : 'text-[#555]'}`}>
                      {step.observationType}
                    </span>
                    <span className="text-sm font-bold text-[#F5F2EA]">{step.areaKm2} km²</span>
                  </div>
                  <div className="text-base font-semibold text-[#F5F2EA] mb-1">{step.label}</div>
                  <div className="text-xs text-[#666]">
                    {new Date(step.timestamp).toISOString().slice(11, 16)} UTC · {step.driftDisplacementKm} km displacement
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* CURRENT STEP SNAPSHOT */}
        {current && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false }} className="border border-[#1f1f1f] bg-[#0a0a0a] p-8 font-mono space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <ProvenanceBadge label={current.observationType} className="mb-2" />
                <h3 className="text-xl font-bold text-[#F5F2EA]">{current.label}</h3>
                <div className="text-xs text-[#666] mt-1">{new Date(current.timestamp).toUTCString()}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-[#141414]">
              <div><div className="text-[9px] text-[#555] uppercase">ESTIMATED AREA</div><div className="text-2xl font-black text-[#E85D04] mt-1">{current.areaKm2} km²</div></div>
              <div><div className="text-[9px] text-[#555] uppercase">DRIFT DISPLACEMENT</div><div className="text-2xl font-black text-[#F5F2EA] mt-1">{current.driftDisplacementKm} km</div></div>
              <div><div className="text-[9px] text-[#555] uppercase">DISCHARGE PHASE</div><div className="text-xs text-[#9B9891] mt-1">{current.phase}</div></div>
            </div>
          </motion.div>
        )}

        {/* RECHARTS CHART */}
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false }} className="border border-[#1f1f1f] bg-[#0c0c0c] p-8 space-y-4 font-mono">
          <div className="text-xs font-mono text-[#E85D04] uppercase tracking-widest">AREA EXTENT EVOLUTION OVER TIME</div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#222' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#222' }} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 0, fontFamily: 'JetBrains Mono', fontSize: 11 }} labelStyle={{ color: '#9B9891' }} itemStyle={{ color: '#E85D04' }} />
                <Line type="monotone" dataKey="areaKm2" stroke="#E85D04" strokeWidth={2} dot={{ fill: '#E85D04', r: 4 }} name="Area (km²)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* FOOTER NAV */}
        <div className="pt-8 border-t border-[#1a1a1a] flex justify-between items-center font-mono">
          <div className="text-xs text-[#555]">Evidence layer 03 verified · Advance to hydrodynamic backtrack</div>
          <button onClick={() => navigate(`/investigation/${code}/origin-drift`)} className="btn-primary text-xs py-3 px-6 flex items-center gap-2">
            <span>PROCEED TO ORIGIN & DRIFT</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </PageShell>
  );
}
