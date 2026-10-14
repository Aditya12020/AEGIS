import { Link, useLocation } from 'react-router-dom';

interface TopNavProps {
  code?: string;
}

const navItems = [
  { label: 'Command', path: '/command' },
  { label: 'Satellite', path: '/satellite' },
  { label: 'Time', path: '/time-machine' },
  { label: 'Origin', path: '/origin-drift' },
  { label: 'AIS Hunt', path: '/ais-hunt' },
  { label: 'Forensics', path: '/forensics' },
  { label: 'Report', path: '/report' },
];

export default function TopNav({ code }: TopNavProps) {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-md border-b border-[#1a1a1a]">
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-6 h-6 bg-[#E85D04] flex items-center justify-center">
            <span className="text-black text-[9px] font-black tracking-widest">A</span>
          </div>
          <span className="font-bold text-[#F5F2EA] tracking-[0.15em] text-sm">AEGIS</span>
        </Link>

        {code && (
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const href = `/investigation/${code}${item.path}`;
              const isActive = location.pathname === href;
              return (
                <Link
                  key={item.path}
                  to={href}
                  className={`px-3 py-1.5 text-[11px] font-mono tracking-widest uppercase transition-colors duration-150 ${
                    isActive
                      ? 'text-[#E85D04] border-b border-[#E85D04]'
                      : 'text-[#9B9891] hover:text-[#F5F2EA]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="text-[10px] font-mono text-[#66635D] tracking-widest">
          {code ? (
            <span className="text-[#9B9891]">INV · <span className="text-[#E85D04]">{code}</span></span>
          ) : (
            <span>MARITIME INTELLIGENCE v2.0</span>
          )}
        </div>
      </div>
    </header>
  );
}
