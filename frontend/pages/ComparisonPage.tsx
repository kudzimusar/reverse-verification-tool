import { Header } from '../components/Header';
import { DeviceComparison } from '../components/DeviceComparison';

export function ComparisonPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <DeviceComparison />
      </main>
    </div>
  );
}
