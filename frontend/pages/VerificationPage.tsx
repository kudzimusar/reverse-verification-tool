import { useState } from 'react';
import { Search, Smartphone, QrCode, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { DeviceVerificationResult } from '../components/DeviceVerificationResult';
import backend from '~backend/client';
import type { VerifyDeviceResponse } from '~backend/verification/verify';

export function VerificationPage() {
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'serial' | 'imei'>('serial');
  const [includeTrustScore, setIncludeTrustScore] = useState(true);
  const [includeFingerprint, setIncludeFingerprint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerifyDeviceResponse | null>(null);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!identifier.trim()) {
      toast({
        title: "Error",
        description: "Please enter a device identifier",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await backend.verification.verify({
        identifier: identifier.trim(),
        identifierType,
        includeTrustScore,
        includeFingerprint,
      });
      setResult(response);
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Device not found or verification failed",
        variant: "destructive",
      });
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      await backend.verification.seed();
      toast({
        title: "Success",
        description: "Sample data has been seeded. Try verifying 'SN123456789'",
      });
    } catch (error) {
      console.error('Seed error:', error);
      toast({
        title: "Error",
        description: "Failed to seed sample data",
        variant: "destructive",
      });
    }
  };

  const handleCalculateTrustScore = async () => {
    if (!result?.device.id) return;

    try {
      await backend.verification.calculateTrustScore({
        deviceId: result.device.id,
      });
      
      // Refresh verification to get updated trust score
      const response = await backend.verification.verify({
        identifier: identifier.trim(),
        identifierType,
        includeTrustScore: true,
        includeFingerprint,
      });
      setResult(response);

      toast({
        title: "Trust Score Updated",
        description: "Trust score has been recalculated with latest data",
      });
    } catch (error) {
      console.error('Trust score calculation error:', error);
      toast({
        title: "Error",
        description: "Failed to calculate trust score",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Advanced Device Verification</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Verify device authenticity with AI-powered trust scoring, multi-node verification, and blockchain-backed security.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Verify a Device</span>
          </CardTitle>
          <CardDescription>
            Enter a serial number or IMEI to check the device's verification status, trust score, and complete history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="identifier-type">Identifier Type</Label>
            <Select value={identifierType} onValueChange={(value: 'serial' | 'imei') => setIdentifierType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serial">Serial Number</SelectItem>
                <SelectItem value="imei">IMEI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="identifier">
              {identifierType === 'serial' ? 'Serial Number' : 'IMEI'}
            </Label>
            <div className="flex space-x-2">
              <Input
                id="identifier"
                placeholder={identifierType === 'serial' ? 'Enter serial number...' : 'Enter IMEI...'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
              <Button onClick={handleVerify} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-medium">Advanced Options</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-trust-score"
                checked={includeTrustScore}
                onCheckedChange={(checked) => setIncludeTrustScore(checked as boolean)}
              />
              <Label htmlFor="include-trust-score" className="text-sm">
                Include AI Trust Score Analysis
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-fingerprint"
                checked={includeFingerprint}
                onCheckedChange={(checked) => setIncludeFingerprint(checked as boolean)}
              />
              <Label htmlFor="include-fingerprint" className="text-sm">
                Include Device Fingerprint Check
              </Label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
            <Button variant="outline" className="flex-1">
              <QrCode className="h-4 w-4 mr-2" />
              Scan QR Code
            </Button>
            <Button variant="outline" className="flex-1">
              <Smartphone className="h-4 w-4 mr-2" />
              NFC Scan
            </Button>
          </div>

          <div className="pt-4 border-t space-y-2">
            <Button variant="secondary" onClick={handleSeedData} className="w-full">
              Load Sample Data (Demo)
            </Button>
            {result && (
              <Button variant="outline" onClick={handleCalculateTrustScore} className="w-full">
                <Shield className="h-4 w-4 mr-2" />
                Recalculate Trust Score
              </Button>
            )}
            <p className="text-sm text-gray-500 text-center">
              Click to add sample devices for testing. Try verifying "SN123456789" after seeding.
            </p>
          </div>
        </CardContent>
      </Card>

      {result && <DeviceVerificationResult result={result} />}
    </div>
  );
}
