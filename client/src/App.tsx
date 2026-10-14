import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import InvestigationHubPage from './pages/InvestigationHubPage';
import NewInvestigationPage from './pages/NewInvestigationPage';
import CreatedInvestigationPage from './pages/CreatedInvestigationPage';
import RunInvestigationPage from './pages/RunInvestigationPage';
import CommandCenterPage from './pages/CommandCenterPage';
import SatellitePage from './pages/SatellitePage';
import TimeMachinePage from './pages/TimeMachinePage';
import OriginDriftPage from './pages/OriginDriftPage';
import AISHuntPage from './pages/AISHuntPage';
import ForensicsPage from './pages/ForensicsPage';
import ReportPage from './pages/ReportPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />

          {/* Authenticated Investigation Hub */}
          <Route
            path="/hub"
            element={
              <ProtectedRoute>
                <InvestigationHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigations"
            element={
              <ProtectedRoute>
                <InvestigationHubPage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Investigation Creation */}
          <Route
            path="/new-investigation"
            element={
              <ProtectedRoute>
                <NewInvestigationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/created"
            element={
              <ProtectedRoute>
                <CreatedInvestigationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/run"
            element={
              <ProtectedRoute>
                <RunInvestigationPage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Operational Investigation Workflow */}
          <Route
            path="/investigation/:code/command"
            element={
              <ProtectedRoute>
                <CommandCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/satellite"
            element={
              <ProtectedRoute>
                <SatellitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/time-machine"
            element={
              <ProtectedRoute>
                <TimeMachinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/origin-drift"
            element={
              <ProtectedRoute>
                <OriginDriftPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/ais-hunt"
            element={
              <ProtectedRoute>
                <AISHuntPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/forensics"
            element={
              <ProtectedRoute>
                <ForensicsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigation/:code/report"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect to Landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
