import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Header } from './components/Header';
import { VerificationPage } from './pages/VerificationPage';
import { SearchPage } from './pages/SearchPage';
import { DeviceDetailsPage } from './pages/DeviceDetailsPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<VerificationPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/device/:id" element={<DeviceDetailsPage />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}
