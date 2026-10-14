import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="space-y-3 text-center font-mono">
          <div className="w-8 h-8 border-2 border-[#E85D04] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-[11px] tracking-[0.3em] text-[#9B9891] uppercase">
            VERIFYING CREDENTIALS...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
