import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import { LoginPage } from './pages/LoginPage';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const VisitNewPage = lazy(() => import('./pages/VisitNewPageImproved'));
const VisitDetailPage = lazy(() => import('./pages/VisitDetailPage'));
const ProductSalePage = lazy(() => import('./pages/ProductSalePage'));
const TrzbyPage = lazy(() => import('./pages/TrzbyPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const OxidantsPage = lazy(() => import('./pages/OxidantsPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const UkonyPage = lazy(() => import('./pages/UkonyPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Načítání...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/visits" element={<Navigate to="/" replace />} />
          <Route path="/visits/new" element={<VisitNewPage />} />
          <Route path="/visits/new/:clientId" element={<VisitNewPage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
          <Route path="/visits/:id/copy" element={<VisitNewPage />} />
          <Route path="/sales" element={<Navigate to="/sales/new" replace />} />
          <Route path="/sales/new" element={<ProductSalePage />} />
          <Route path="/trzby" element={<TrzbyPage />} />
          <Route path="/admin" element={<Navigate to="/admin/materials" replace />} />
          <Route path="/admin/materials" element={<MaterialsPage />} />
          <Route path="/admin/oxidants" element={<OxidantsPage />} />
          <Route path="/admin/products" element={<ProductsPage />} />
          <Route path="/admin/ukony" element={<UkonyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
