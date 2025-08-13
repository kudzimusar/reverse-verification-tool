import { useState } from 'react';
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { GetStatusResponse, GetHistoryResponse } from '~backend/verification/badge_lifecycle';

interface VerificationBadgeProps {
  entityId: number;
  entityName: string;
  showLifecycleButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function VerificationBadge({ entityId, entityName, showLifecycleButton = true, size = 'md' }: VerificationBadgeProps) {
  const [status, setStatus] = useState<GetStatusResponse | null>(null);
  const [history, setHistory] = useState<GetHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const { toast } = useToast();

  const loadStatus = async () => {
    try {
      const response = await backend.verification.getStatus({ entityId });
      setStatus(response);
    } catch (error) {
      console.error('Load status error:', error);
    }
  };

  const loadHistory = async () => {
    if (history) return; // Already loaded

    setIsLoading(true);
    try {
      const response = await backend.verification.getHistory({ entityId });
      setHistory(response);
    } catch (error) {
      console.error('Load history error:', error);
      toast({
        title: "Error",
        description: "Failed to load verification history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load status on mount
  React.useEffect(() => {
    loadStatus();
  }, [entityId]);

  const getBadgeConfig = (status: string) => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          label: 'Verified',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'revoked':
        return {
          icon: XCircle,
          label: 'Revoked',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'expired':
        return {
          icon: Clock,
          label: 'Expired',
          variant: 'secondary' as const,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
        };
      case 'pending':
      default:
        return {
          icon: AlertTriangle,
          label: 'Pending',
          variant: 'outline' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!status) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Clock className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  const config = getBadgeConfig(status.status);
  const Icon = config.icon;
  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const badgeSize = size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-xs';

  const tooltipText = status.status === 'verified' && status.verifiedBy && status.issuedAt
    ? `Verified on ${formatDate(status.issuedAt)} by ${status.verifiedBy}`
    : `Status: ${config.label}`;

  return (
    <div className="flex items-center space-x-2">
      <Badge 
        className={`${config.className} flex items-center space-x-1 ${badgeSize}`}
        title={tooltipText}
      >
        <Icon className={iconSize} />
        <span>{config.label}</span>
      </Badge>

      {showLifecycleButton && (
        <Dialog open={showLifecycle} onOpenChange={setShowLifecycle}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadHistory}
              className="h-6 px-2 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Lifecycle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Verification Lifecycle</span>
              </DialogTitle>
              <DialogDescription>
                Complete verification history for {entityName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Current Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-6 w-6" />
                      <div>
                        <p className="font-semibold">{config.label}</p>
                        {status.verifiedBy && (
                          <p className="text-sm text-gray-600">Verified by {status.verifiedBy}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={config.className}>
                      {config.label}
                    </Badge>
                  </div>

                  {status.issuedAt && (
                    <div className="text-sm text-gray-600">
                      <p>Issued: {formatDateTime(status.issuedAt)}</p>
                      {status.expiryDate && (
                        <p>Expires: {formatDateTime(status.expiryDate)}</p>
                      )}
                      {status.revokedAt && (
                        <p>Revoked: {formatDateTime(status.revokedAt)}</p>
                      )}
                    </div>
                  )}

                  {status.revocationReason && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-800">
                        <strong>Revocation Reason:</strong> {status.revocationReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* History Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">History Timeline</CardTitle>
                  <CardDescription>
                    Chronological record of all verification events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600">Loading history...</p>
                    </div>
                  ) : history && history.history.length > 0 ? (
                    <div className="space-y-4">
                      {history.history.map((event, index) => {
                        const eventConfig = getBadgeConfig(event.status);
                        const EventIcon = eventConfig.icon;
                        
                        return (
                          <div key={index}>
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <EventIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold capitalize">
                                    {event.status === 'verified' ? 'Verification Granted' :
                                     event.status === 'revoked' ? 'Verification Revoked' :
                                     event.status === 'expired' ? 'Verification Expired' :
                                     event.status === 'extended' ? 'Verification Extended' :
                                     'Status Updated'}
                                  </h4>
                                  <span className="text-sm text-gray-600">
                                    {formatDateTime(event.timestamp)}
                                  </span>
                                </div>
                                
                                {event.verifiedBy && (
                                  <p className="text-sm text-gray-600">
                                    By: {event.verifiedBy}
                                  </p>
                                )}
                                
                                {event.method && (
                                  <p className="text-sm text-gray-600">
                                    Method: {event.method}
                                  </p>
                                )}
                                
                                {(event.notes || event.reason) && (
                                  <p className="text-sm text-gray-700">
                                    {event.notes || event.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                            {index < history.history.length - 1 && (
                              <Separator className="mt-4" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600">No verification history available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
