import { useState } from 'react';
import { Calendar, MapPin, Shield, AlertTriangle, Flag, MessageCircle, Eye, Fingerprint } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './StatusBadge';
import { ReportDialog } from './ReportDialog';
import { TrustScoreDisplay } from './TrustScoreDisplay';
import { WatchDeviceDialog } from './WatchDeviceDialog';
import type { VerifyDeviceResponse } from '~backend/verification/verify';

interface DeviceVerificationResultProps {
  result: VerifyDeviceResponse;
}

export function DeviceVerificationResult({ result }: DeviceVerificationResultProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showWatchDialog, setShowWatchDialog] = useState(false);
  const { device, currentOwner, ownershipHistory, events, reportCount, trustScore, fingerprint, verificationMetadata } = result;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getVerificationBadge = (level: string) => {
    const variants = {
      basic: 'secondary',
      verified: 'default',
      business: 'destructive',
    } as const;
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'secondary'}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Device Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{device.deviceName}</CardTitle>
              <CardDescription>
                {device.brand} {device.model} • Serial: {device.serialNumber}
                {device.imei && ` • IMEI: ${device.imei}`}
              </CardDescription>
            </div>
            {device.imageUrl && (
              <img
                src={device.imageUrl}
                alt={device.deviceName}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <StatusBadge status={device.status} size="lg" />
              {device.trustScore && (
                <Badge variant="outline" className="text-sm">
                  Trust Score: {device.trustScore}
                </Badge>
              )}
              {fingerprint?.hasFingerprint && (
                <Badge variant="outline" className="text-sm flex items-center space-x-1">
                  <Fingerprint className="h-3 w-3" />
                  <span>Fingerprinted</span>
                </Badge>
              )}
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Last verified: {formatDate(device.lastVerified)}</p>
              {reportCount > 0 && (
                <p className="text-red-600 font-medium">
                  {reportCount} report{reportCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Verification Metadata */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <p className="font-medium">Verification ID: {verificationMetadata.verificationId}</p>
                <p className="text-gray-600">
                  Sources checked: {verificationMetadata.dataSourcesChecked.join(', ')}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className={`font-medium ${getConfidenceColor(verificationMetadata.confidence)}`}>
                  {verificationMetadata.confidence}% Confidence
                </p>
                <p className="text-gray-600">
                  {formatDate(verificationMetadata.timestamp)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust Score Display */}
      {trustScore && (
        <TrustScoreDisplay trustScore={trustScore} />
      )}

      {/* Current Owner */}
      {currentOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Current Owner</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">{currentOwner.ownerAlias}</p>
                <p className="text-sm text-gray-600 capitalize">{currentOwner.ownerType}</p>
              </div>
              {getVerificationBadge(currentOwner.verificationLevel)}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Since {formatDate(currentOwner.transferDate)}</span>
              </div>
              {currentOwner.locationCountry && (
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{currentOwner.locationCountry}</span>
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <MessageCircle className="h-4 w-4 mr-2" />
                Message Owner
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowWatchDialog(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Watch Device
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fingerprint Information */}
      {fingerprint && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Fingerprint className="h-5 w-5" />
              <span>Device Fingerprint</span>
            </CardTitle>
            <CardDescription>
              Hardware-level device identification for enhanced security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fingerprint.hasFingerprint ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fingerprint Status</span>
                  <Badge variant="default">Verified</Badge>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-mono text-gray-600 break-all">
                    {fingerprint.fingerprintHash}
                  </p>
                </div>
                {fingerprint.fingerprintAge !== undefined && (
                  <p className="text-sm text-gray-600">
                    Fingerprint created {fingerprint.fingerprintAge} days ago
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600">No device fingerprint available</p>
                <p className="text-sm text-gray-500 mt-1">
                  Device fingerprinting provides additional security against ID tampering
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ownership History */}
      <Card>
        <CardHeader>
          <CardTitle>Ownership History</CardTitle>
          <CardDescription>
            Complete ownership trail for this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ownershipHistory.map((owner, index) => (
              <div key={index} className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium">{owner.ownerAlias}</p>
                    {owner.isCurrentOwner && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 capitalize">{owner.ownerType}</p>
                </div>
                <div className="text-right space-y-1">
                  {getVerificationBadge(owner.verificationLevel)}
                  <p className="text-sm text-gray-600">
                    {formatDate(owner.transferDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device Events */}
      <Card>
        <CardHeader>
          <CardTitle>Device History</CardTitle>
          <CardDescription>
            Recorded events and activities for this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No events recorded</p>
            ) : (
              events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium capitalize">{event.eventType.replace('_', ' ')}</p>
                      {event.eventDescription && (
                        <p className="text-sm text-gray-600">{event.eventDescription}</p>
                      )}
                      {event.providerName && (
                        <p className="text-sm text-gray-500">by {event.providerName}</p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      {event.verified && (
                        <Badge variant="default" className="text-xs">Verified</Badge>
                      )}
                      <p className="text-sm text-gray-600">
                        {formatDate(event.eventDate)}
                      </p>
                    </div>
                  </div>
                  {index < events.length - 1 && <Separator className="mt-4" />}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="destructive"
              onClick={() => setShowReportDialog(true)}
              className="flex-1"
            >
              <Flag className="h-4 w-4 mr-2" />
              Report This Device
            </Button>
            <Button variant="outline" className="flex-1">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact Seller
            </Button>
            <Button variant="outline" className="flex-1">
              View Related Devices
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Important Notice</p>
              <p className="text-sm text-gray-600">
                Data provided via STOLEN blockchain ledger with multi-node verification. Information is tamper-proof but dependent on reporting accuracy. 
                Trust scores are calculated using AI algorithms and should be used as guidance only. 
                Always verify device condition and seller legitimacy before making any transaction.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        deviceId={device.id}
        deviceName={device.deviceName}
      />

      <WatchDeviceDialog
        open={showWatchDialog}
        onOpenChange={setShowWatchDialog}
        deviceId={device.id}
        deviceName={device.deviceName}
      />
    </div>
  );
}
