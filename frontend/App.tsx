import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { VerificationPage } from './pages/VerificationPage';
import { SearchPage } from './pages/SearchPage';
import { DeviceDetailsPage } from './pages/DeviceDetailsPage';
import { ApiDashboardPage } from './pages/ApiDashboardPage';
import { LifecyclePage } from './pages/LifecyclePage';
import { ComparisonPage } from './pages/ComparisonPage';
import { AdvancedSearchPage } from './pages/AdvancedSearchPage';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/api-dashboard" element={
              <ErrorBoundary>
                <ApiDashboardPage />
              </ErrorBoundary>
            } />
            <Route path="/lifecycle/:badgeId" element={
              <ErrorBoundary>
                <LifecyclePage />
              </ErrorBoundary>
            } />
            <Route path="/*" element={
              <>
                <Header />
                <main className="container mx-auto px-4 py-8">
                  <Routes>
                    <Route path="/" element={
                      <ErrorBoundary>
                        <VerificationPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/search" element={
                      <ErrorBoundary>
                        <SearchPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/device/:id" element={
                      <ErrorBoundary>
                        <DeviceDetailsPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/compare" element={
                      <ErrorBoundary>
                        <ComparisonPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/advanced-search" element={
                      <ErrorBoundary>
                        <AdvancedSearchPage />
                      </ErrorBoundary>
                    } />
                  </Routes>
                </main>
              </>
            } />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
