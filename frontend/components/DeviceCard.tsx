import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import type { SearchResult } from '~backend/verification/search';

interface DeviceCardProps {
  device: SearchResult;
}

export function DeviceCard({ device }: DeviceCardProps) {
  return (
    <Link to={`/device/${device.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="space-y-4">
            {device.imageUrl && (
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={device.imageUrl}
                  alt={device.deviceName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                {device.deviceName}
              </h3>
              <p className="text-gray-600 text-sm">
                {device.brand} {device.model}
              </p>
              <div className="flex items-center justify-between">
                <StatusBadge status={device.status as "clean" | "flagged" | "under_investigation"} />
                <Badge variant="outline" className="text-xs">
                  {device.serialNumber}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
