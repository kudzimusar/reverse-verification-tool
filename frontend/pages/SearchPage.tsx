import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceCard } from '../components/DeviceCard';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { SearchDevicesResponse } from '~backend/verification/search';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchDevicesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await backend.verification.search({
        query: searchQuery.trim(),
        limit: 20,
      });
      setResults(response);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: "Failed to search devices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Search Devices</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Search for devices by name, model, or brand to view their verification status.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Device Search</span>
          </CardTitle>
          <CardDescription>
            Enter a device name, model, or brand to find registered devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search for iPhone, Samsung Galaxy, etc..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Searching devices...</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              Search Results
            </h2>
            <p className="text-gray-600">
              {results.total} device{results.total !== 1 ? 's' : ''} found
            </p>
          </div>

          {results.devices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600">No devices found matching your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.devices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
