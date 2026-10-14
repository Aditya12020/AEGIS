import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { AlertTriangleIcon, ArrowRightIcon } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [role, setRole] = useState<'USER' | 'OFFICER'>('OFFICER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectPath = (location.state as any)?.from || '/hub';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        await login({ email, password });
      } else {
        await register({ email, password, name, badgeNumber, role });
      }
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // Quick Demo Fillers
  function fillDemoOfficer() {
    setMode('LOGIN');
    setEmail('officer@aegis.maritime');
    setPassword('aegis-officer-2026');
    setError('');
  }

  function fillDemoUser() {
    setMode('LOGIN');
    setEmail('investigator@aegis.maritime');
    setPassword('aegis-user-2026');
    setError('');
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F2EA] flex flex-col justify-between selection:bg-[#E85D04] selection:text-black">
      {/* Top bar */}
      <header className="px-8 h-16 border-b border-[#141414] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-5 h-5 bg-[#E85D04] flex items-center justify-center">
            <span className="text-black text-[9px] font-black tracking-widest">A</span>
          </div>
          <span className="font-bold text-[#F5F2EA] tracking-[0.2em] text-xs">AEGIS</span>
        </Link>
        <div className="text-[10px] font-mono text-[#66635D] tracking-widest uppercase">
          SECURE INVESTIGATION WORKSTATION
        </div>
      </header>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md border border-[#1f1f1f] bg-[#090909] p-8 sm:p-10 shadow-2xl relative"
        >
          <div className="space-y-2 mb-8 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="w-2 h-2 bg-[#E85D04]" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-[#E85D04] uppercase">
                AEGIS SECURITY GATEWAY
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#F5F2EA] font-mono">
              SECURE INVESTIGATION ACCESS
            </h1>
            <p className="text-xs font-mono text-[#9B9891]">
              Enter authorized personnel credentials to access the Investigation Hub.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-[#1a1a1a] mb-6 font-mono text-xs">
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); setError(''); }}
              className={`pb-3 px-4 transition-colors relative ${
                mode === 'LOGIN' ? 'text-[#F5F2EA] font-bold' : 'text-[#555] hover:text-[#9B9891]'
              }`}
            >
              SIGN IN
              {mode === 'LOGIN' && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E85D04]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMode('REGISTER'); setError(''); }}
              className={`pb-3 px-4 transition-colors relative ${
                mode === 'REGISTER' ? 'text-[#F5F2EA] font-bold' : 'text-[#555] hover:text-[#9B9891]'
              }`}
            >
              CREATE ACCOUNT
              {mode === 'REGISTER' && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E85D04]" />
              )}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3.5 border border-red-900/60 bg-red-950/20 flex items-start gap-2.5 text-red-400 text-xs font-mono leading-relaxed">
              <AlertTriangleIcon size={14} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            {mode === 'REGISTER' && (
              <>
                <div>
                  <label className="text-[10px] text-[#9B9891] uppercase tracking-wider block mb-1.5">
                    Full Name & Title
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cmdr. Vikram Sharma"
                    className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-2.5 outline-none focus:border-[#E85D04] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#9B9891] uppercase tracking-wider block mb-1.5">
                      Service / Badge ID
                    </label>
                    <input
                      type="text"
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
                      placeholder="IN-CG-8821"
                      className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-2.5 outline-none focus:border-[#E85D04] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9B9891] uppercase tracking-wider block mb-1.5">
                      Assigned Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'USER' | 'OFFICER')}
                      className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-3 py-2.5 outline-none focus:border-[#E85D04] transition-colors"
                    >
                      <option value="OFFICER">OFFICER (Full Access)</option>
                      <option value="USER">USER (Investigator)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] text-[#9B9891] uppercase tracking-wider block mb-1.5">
                Email / Officer ID
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@aegis.maritime"
                className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-2.5 outline-none focus:border-[#E85D04] transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#9B9891] uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-2.5 outline-none focus:border-[#E85D04] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center text-xs py-3 mt-4 tracking-widest uppercase cursor-pointer"
            >
              {loading ? (
                'AUTHENTICATING...'
              ) : (
                <span className="flex items-center gap-2">
                  <span>{mode === 'LOGIN' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
                  <ArrowRightIcon size={14} />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-[#1a1a1a] font-mono text-[11px] space-y-2.5">
            <div className="text-[9px] uppercase tracking-widest text-[#555]">
              Quick Demo Personnel Credentials
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillDemoOfficer}
                className="p-2 border border-[#222] bg-[#0e0e0e] hover:border-[#E85D04] text-left text-[10px] text-[#9B9891] transition-colors cursor-pointer"
              >
                <div className="text-[#E85D04] font-bold">OFFICER ACCESS</div>
                <div>Cmdr. Vikram Sharma</div>
              </button>
              <button
                type="button"
                onClick={fillDemoUser}
                className="p-2 border border-[#222] bg-[#0e0e0e] hover:border-[#9B9891] text-left text-[10px] text-[#9B9891] transition-colors cursor-pointer"
              >
                <div className="text-[#F5F2EA] font-bold">USER ACCESS</div>
                <div>Dr. Ananya Roy</div>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-[#141414] text-center text-[10px] font-mono text-[#555] uppercase tracking-widest">
        AEGIS MARITIME INTELLIGENCE · RESTRICTED ACCESS SYSTEM
      </footer>
    </div>
  );
}
