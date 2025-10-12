import { useState } from 'react';
import backend from '~backend/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrustScoreDisplay } from './TrustScoreDisplay';
import { AlertTriangle, CheckCircle, GitCompare, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function DeviceComparison() {
  const [deviceIds, setDeviceIds] = useState<string[]>(['']);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addDevice = () => {
    if (deviceIds.length < 5) {
      setDeviceIds([...deviceIds, '']);
    }
  };

  const removeDevice = (index: number) => {
    setDeviceIds(deviceIds.filter((_, i) => i !== index));
  };

  const updateDeviceId = (index: number, value: string) => {
    const newIds = [...deviceIds];
    newIds[index] = value;
    setDeviceIds(newIds);
  };

  const compareDevices = async () => {
    const validIds = deviceIds.filter(id => id.trim() !== '');
    
    if (validIds.length < 2) {
      toast({
        title: 'Error',
        description: 'Please enter at least 2 device IDs',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await backend.verification.compareDevices({ deviceIds: validIds });
      setComparison(result);
    } catch (error) {
      console.error('Comparison error:', error);
      toast({
        title: 'Error',
        description: 'Failed to compare devices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitCompare className="h-5 w-5" />
          <h2 className="text-xl font-bold">Compare Devices</h2>
        </div>

        <div className="space-y-3">
          {deviceIds.map((id, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={`Device ID ${index + 1}`}
                value={id}
                onChange={(e) => updateDeviceId(index, e.target.value)}
              />
              {deviceIds.length > 1 && (
                <Button variant="outline" size="icon" onClick={() => removeDevice(index)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={addDevice} disabled={deviceIds.length >= 5} variant="outline">
            Add Device (max 5)
          </Button>
          <Button onClick={compareDevices} disabled={loading}>
            {loading ? 'Comparing...' : 'Compare'}
          </Button>
        </div>
      </Card>

      {comparison && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Comparison Summary</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Highest Trust Score</p>
                <p className="text-2xl font-bold">{comparison.metrics.highestTrustScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lowest Trust Score</p>
                <p className="text-2xl font-bold">{comparison.metrics.lowestTrustScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-2xl font-bold">{comparison.metrics.averageTrustScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Range</p>
                <p className="text-2xl font-bold">
                  {(comparison.metrics.highestTrustScore - comparison.metrics.lowestTrustScore).toFixed(1)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">Safest: {comparison.comparison.safest}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Riskiest: {comparison.comparison.riskiest}</span>
              </div>
            </div>

            {comparison.metrics.recommendations.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Recommendations:</h4>
                {comparison.metrics.recommendations.map((rec: string, idx: number) => (
                  <p key={idx} className="text-sm text-muted-foreground">• {rec}</p>
                ))}
              </div>
            )}

            {comparison.comparison.differences.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Key Differences:</h4>
                {comparison.comparison.differences.map((diff: string, idx: number) => (
                  <p key={idx} className="text-sm text-muted-foreground">• {diff}</p>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4">
            {comparison.devices.map((device: any) => (
              <Card key={device.deviceId} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">{device.imei}</h4>
                    <p className="text-sm text-muted-foreground">
                      {device.manufacturer} {device.model}
                    </p>
                  </div>
                  <Badge variant={
                    device.status === 'verified' ? 'default' :
                    device.status === 'flagged' || device.status === 'reported' ? 'destructive' :
                    'secondary'
                  }>
                    {device.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Trust Score</p>
                    <div className="text-lg font-bold">{device.trustScore.toFixed(1)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verifications</p>
                    <p className="text-lg font-semibold">{device.verificationCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reports</p>
                    <p className="text-lg font-semibold">{device.reportCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Watchers</p>
                    <p className="text-lg font-semibold">{device.watcherCount}</p>
                  </div>
                </div>

                {device.flaggedReason && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                    <p className="text-xs font-medium text-destructive">{device.flaggedReason}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
