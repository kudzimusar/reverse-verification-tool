import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DeviceVerificationResult } from '../components/DeviceVerificationResult';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { GetDeviceResponse } from '~backend/verification/get_device';

export function DeviceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<GetDeviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadDevice = async () => {
      if (!id) return;

      try {
        const response = await backend.verification.getDevice({
          id: parseInt(id),
        });
        setResult(response);
      } catch (error) {
        console.error('Load device error:', error);
        toast({
          title: "Error",
          description: "Failed to load device details",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDevice();
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-8">
          <p className="text-gray-600">Loading device details...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/search">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </Link>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">Device not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/search">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>
      </Link>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          {result.device.deviceName}
        </h1>
        <p className="text-gray-600">
          {result.device.brand} {result.device.model}
        </p>
      </div>

      <DeviceVerificationResult result={result} />
    </div>
  );
}
