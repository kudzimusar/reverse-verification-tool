import { useEffect, useState } from 'react';
import backend from '~backend/client';
import type { DeviceStatusUpdate } from '~backend/verification/realtime_monitoring';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface RealTimeMonitorProps {
  deviceIds: string[];
}

export function RealTimeMonitor({ deviceIds }: RealTimeMonitorProps) {
  const [updates, setUpdates] = useState<DeviceStatusUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (deviceIds.length === 0) return;

    let stream: AsyncIterable<DeviceStatusUpdate> | null = null;
    let mounted = true;

    const connect = async () => {
      try {
        setIsConnected(true);
        stream = await backend.verification.monitorDevices({ deviceIds });

        for await (const update of stream) {
          if (!mounted) break;
          
          setUpdates(prev => [update, ...prev.slice(0, 49)]);
        }
      } catch (error) {
        console.error('Stream error:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      mounted = false;
      setIsConnected(false);
    };
  }, [deviceIds]);

  if (deviceIds.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className={`h-5 w-5 ${isConnected ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
        <h3 className="text-lg font-semibold">Real-time Updates</h3>
        {isConnected && <Badge variant="outline">Live</Badge>}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No updates yet...</p>
        ) : (
          updates.map((update, idx) => (
            <div key={`${update.deviceId}-${idx}`} className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div>
                <p className="text-sm font-medium">{update.deviceId}</p>
                {update.reason && <p className="text-xs text-muted-foreground">{update.reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={
                  update.status === 'verified' ? 'default' :
                  update.status === 'flagged' || update.status === 'stolen' ? 'destructive' :
                  'secondary'
                }>
                  {update.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(update.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
