import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, Loader2Icon, XCircleIcon, CircleIcon } from 'lucide-react';
import PageShell from '../components/PageShell';
import { api } from '../api/client';

const PIPELINE_STEPS = [
  { id: 'created', label: 'INVESTIGATION CREATED', sub: 'Incident parameters and AOI boundary validated' },
  { id: 'evidence', label: 'ACQUIRING EVIDENCE', sub: 'Satellite archives & geofenced AIS telemetry ingested' },
  { id: 'satellite', label: 'SATELLITE ANALYSIS', sub: 'Sentinel-1 C-band SAR dual-pol scenes processed' },
  { id: 'spill', label: 'SPILL DETECTION', sub: 'Dark patch segmentation & surface oil extent calculated' },
  { id: 'drift', label: 'ORIGIN / DRIFT', sub: 'Lagrangian advection and reverse backtrack trajectory solved' },
  { id: 'ais', label: 'AIS CORRELATION', sub: 'Discharge corridor vessel tracks & CPA cross-referenced' },
  { id: 'forensic', label: 'FORENSIC ANALYSIS', sub: 'Multi-criteria attribution scoring converged' },
];

type StepStatus = 'pending' | 'running' | 'done' | 'unavailable' | 'error';

export default function RunInvestigationPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(PIPELINE_STEPS.map((s) => [s.id, 'pending']))
  );
  const [stepDetails, setStepDetails] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!code || ranRef.current) return;
    ranRef.current = true;
    runPipeline();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code]);

  function mapEventsToSteps(events: any[]) {
    const setStep = (id: string, status: StepStatus) =>
      setStepStatuses((prev) => ({ ...prev, [id]: status }));

    const getStatus = (stage: string): StepStatus | null => {
      const ev = events.find((e: any) => e.stage === stage);
      if (!ev) return null;
      if (ev.status === 'COMPLETED') return 'done';
      if (ev.status === 'FAILED') return 'error';
      if (ev.status === 'DATA_UNAVAILABLE' || ev.status === 'NO_SATELLITE_COVERAGE') return 'unavailable';
      return 'done';
    };

    const sat = getStatus('SATELLITE_ACQUISITION');
    const spill = getStatus('SPILL_ANALYSIS');
    const drift = getStatus('DRIFT_COMPUTATION');
    const ais = getStatus('AIS_INGESTION');
    const attr = getStatus('ATTRIBUTION_CONVERGENCE');
    const dossier = getStatus('DOSSIER_SEALED');

    setStep('created', 'done');
    setStep('evidence', 'done');
    if (sat) setStep('satellite', sat);
    if (spill) setStep('spill', spill);
    if (drift) setStep('drift', drift);
    if (ais) setStep('ais', ais);
    const forensicStatus = attr || dossier;
    if (forensicStatus) setStep('forensic', forensicStatus);

    const details: Record<string, string> = {};
    events.forEach((ev: any) => {
      const stageMap: Record<string, string> = {
        SATELLITE_ACQUISITION: 'satellite',
        SPILL_ANALYSIS: 'spill',
        DRIFT_COMPUTATION: 'drift',
        AIS_INGESTION: 'ais',
        ATTRIBUTION_CONVERGENCE: 'forensic',
      };
      const key = stageMap[ev.stage];
      if (key && (ev.description || ev.title)) {
        details[key] = ev.description || ev.title;
      }
    });
    setStepDetails((prev) => ({ ...prev, ...details }));
  }

  async function runPipeline() {
    const setStep = (id: string, status: StepStatus) =>
      setStepStatuses((prev) => ({ ...prev, [id]: status }));

    setStep('created', 'running');
    await delay(200);
    setStep('created', 'done');
    setStep('evidence', 'running');
    await delay(300);
    setStep('evidence', 'done');
    setStep('satellite', 'running');

    // First check if pipeline already completed (handles page refresh)
    try {
      const existingStatus = await api.investigations.status(code!);
      if (existingStatus?.status === 'COMPLETED' || existingStatus?.stage === 'ATTRIBUTION_CONVERGED') {
        if (existingStatus.events?.length > 0) {
          mapEventsToSteps(existingStatus.events);
        } else {
          setStep('satellite', 'done');
          setStep('spill', 'done');
          setStep('drift', 'done');
          setStep('ais', 'done');
          setStep('forensic', 'done');
        }
        setComplete(true);
        return;
      }
    } catch (_) {
      // status endpoint failed, continue with run
    }

    // Fire the POST — don't await it (it's long-running)
    api.investigations.run(code!).then((result: any) => {
      // When POST returns, finalize from result.steps
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      const satStep = result.steps?.find((s: any) => s.step === 'SATELLITE_ACQUISITION');
      const spillStep = result.steps?.find((s: any) => s.step === 'SPILL_ANALYSIS');
      const driftStep = result.steps?.find((s: any) => s.step === 'DRIFT_COMPUTATION');
      const aisStep = result.steps?.find((s: any) => s.step === 'AIS_INGESTION');
      const convergenceStep = result.steps?.find((s: any) => s.step === 'ATTRIBUTION_CONVERGENCE');

      const resolveStep = (s: any): StepStatus => {
        if (!s) return 'done';
        if (s.status === 'FAILED') return 'error';
        if (s.status === 'DATA_UNAVAILABLE' || s.status === 'NO_SATELLITE_COVERAGE') return 'unavailable';
        return 'done';
      };

      setStep('satellite', resolveStep(satStep));
      setStep('spill', resolveStep(spillStep));
      setStep('drift', resolveStep(driftStep));
      setStep('ais', resolveStep(aisStep));
      setStep('forensic', resolveStep(convergenceStep));

      const details: Record<string, string> = {};
      if (satStep?.detail || satStep?.label) details['satellite'] = satStep.detail || satStep.label;
      if (spillStep?.detail || spillStep?.label) details['spill'] = spillStep.detail || spillStep.label;
      if (driftStep?.detail || driftStep?.label) details['drift'] = driftStep.detail || driftStep.label;
      if (aisStep?.detail || aisStep?.label) details['ais'] = aisStep.detail || aisStep.label;
      if (convergenceStep?.detail || convergenceStep?.label) details['forensic'] = convergenceStep.detail || convergenceStep.label;
      setStepDetails((prev) => ({ ...prev, ...details }));
      setComplete(true);
    }).catch((err: any) => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      // If 202 (already running), just keep polling
      if (!err.message?.includes('already actively running')) {
        setError(err.message || 'Investigation pipeline execution failed');
        setStep('satellite', 'error');
        setComplete(true);
      }
    });

    // Poll /status every 2s to update progress while POST is running
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.investigations.status(code!);
        if (status?.events?.length > 0) {
          mapEventsToSteps(status.events);
        }
        // Stage-based running indicators
        if (status?.stage === 'SATELLITE_ACQUIRING') {
          setStep('satellite', 'running');
        } else if (status?.stage === 'METOCEAN_ACQUIRING') {
          setStep('satellite', 'done');
          setStep('spill', 'done');
          setStep('drift', 'running');
        }
        // Terminal states
        if (status?.status === 'COMPLETED' || status?.status === 'PARTIAL' || status?.stage === 'ATTRIBUTION_CONVERGED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setComplete(true);
        }
      } catch (_) {
        // polling error — keep polling
      }
    }, 2000);
  }

  function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const allDone = Object.values(stepStatuses).every((s) => s === 'done');

  return (
    <PageShell>
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="mb-10">
            <div className="w-1 h-8 bg-[#E85D04] mb-6" />
            <div className="text-[10px] font-mono tracking-[0.4em] text-[#9B9891] uppercase mb-3">
              {code}
            </div>
            <h1 className="text-2xl font-bold text-[#F5F2EA]">Running Investigation</h1>
          </div>

          <div className="space-y-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const status = stepStatuses[step.id];
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="flex items-start gap-4 py-4 border-b border-[#141414] last:border-0"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {status === 'done' && (
                      <div className="w-5 h-5 bg-[#F5F2EA] flex items-center justify-center">
                        <CheckIcon size={11} className="text-black stroke-[3]" />
                      </div>
                    )}
                    {status === 'running' && (
                      <div className="w-5 h-5 border border-[#E85D04] flex items-center justify-center">
                        <Loader2Icon size={11} className="text-[#E85D04] animate-spin" />
                      </div>
                    )}
                    {status === 'unavailable' && (
                      <div className="w-5 h-5 border border-[#eab308] bg-[#eab308]/15 flex items-center justify-center text-[#eab308] text-xs font-mono font-bold leading-none">
                        —
                      </div>
                    )}
                    {status === 'error' && (
                      <XCircleIcon size={20} className="text-red-500" />
                    )}
                    {status === 'pending' && (
                      <div className="w-5 h-5 border border-[#333] flex items-center justify-center">
                        <CircleIcon size={9} className="text-[#333]" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${
                      status === 'done' ? 'text-[#F5F2EA]' :
                      status === 'running' ? 'text-[#E85D04]' :
                      status === 'unavailable' ? 'text-[#eab308]' :
                      status === 'error' ? 'text-red-400' : 'text-[#555]'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-[11px] text-[#555] mt-0.5 font-mono">{step.sub}</div>
                    {status === 'unavailable' && (
                      <div className="text-[#eab308] text-[11px] font-mono mt-1 leading-snug">
                        {stepDetails[step.id] ? `DATA UNAVAILABLE — ${stepDetails[step.id]}` : 'DATA UNAVAILABLE FOR THIS INCIDENT / DATE'}
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="text-red-400 text-[11px] font-mono mt-1 leading-snug">
                        PROVIDER ERROR — {stepDetails[step.id] || error || 'Operation failed'}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {complete && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-10"
            >
              <div className="text-[11px] font-mono tracking-widest text-[#9B9891] mb-6">
                Attribution converged · {new Date().toUTCString()}
              </div>
              <button
                onClick={() => navigate(`/investigation/${code}/command`)}
                className="btn-primary w-full justify-center text-base py-4"
              >
                OPEN COMMAND CENTER →
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
