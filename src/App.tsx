import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { JobsDiscoveryPage } from './pages/JobsDiscoveryPage';
import { WorkersDiscoveryPage } from './pages/WorkersDiscoveryPage';
import { MapDiscoveryPage } from './pages/MapDiscoveryPage';
import { LearningCenterPage } from './pages/LearningCenterPage';
import { SkillPassportPublicPage } from './pages/SkillPassportPublicPage';
import { WorkerDashboard } from './dashboards/WorkerDashboard';
import { EmployerDashboard } from './dashboards/EmployerDashboard';
import { AdminDashboard } from './dashboards/AdminDashboard';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactElement;
  allowedRoles: Array<'worker' | 'employer' | 'admin'>;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Verifying session...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'admin'
        ? '/dashboard/admin'
        : user.role === 'employer'
        ? '/dashboard/employer'
        : '/dashboard/worker';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/jobs" element={<JobsDiscoveryPage />} />
              <Route path="/workers" element={<WorkersDiscoveryPage />} />
              <Route path="/map" element={<MapDiscoveryPage />} />
              <Route path="/learning" element={<LearningCenterPage />} />
              <Route path="/passport/:code" element={<SkillPassportPublicPage />} />

              <Route
                path="/dashboard/worker"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <WorkerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/employer"
                element={
                  <ProtectedRoute allowedRoles={['employer']}>
                    <EmployerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <AIAssistantDrawer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
