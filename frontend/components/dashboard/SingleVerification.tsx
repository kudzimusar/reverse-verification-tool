import { useState } from 'react';
import { Search, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { StatusBadge } from '../StatusBadge';
import backend from '~backend/client';
import type { VerifyDeviceResponse } from '~backend/verification/verify';

export function SingleVerification() {
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'serial' | 'imei'>('serial');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerifyDeviceResponse | null>(null);
  const [apiResponse, setApiResponse] = useState('');
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
      });
      setResult(response);
      setApiResponse(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Verification error:', error);
      setApiResponse(JSON.stringify({ error: error instanceof Error ? error.message : 'Verification failed' }, null, 2));
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

  const copyApiResponse = () => {
    navigator.clipboard.writeText(apiResponse);
    toast({
      title: "Copied",
      description: "API response copied to clipboard",
    });
  };

  const apiEndpoint = `POST /verification/verify`;
  const exampleRequest = JSON.stringify({
    identifier: identifier || "SN123456789",
    identifierType: identifierType
  }, null, 2);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Single Device Verification</span>
          </CardTitle>
          <CardDescription>
            Test device verification and view the API response format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="space-y-4">
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
                <Input
                  id="identifier"
                  placeholder={identifierType === 'serial' ? 'Enter serial number...' : 'Enter IMEI...'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </div>

              <Button onClick={handleVerify} disabled={isLoading} className="w-full">
                {isLoading ? 'Verifying...' : 'Verify Device'}
              </Button>
            </div>

            {/* API Example */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">API Endpoint</Label>
                <div className="mt-1 p-3 bg-gray-100 rounded-md font-mono text-sm">
                  {apiEndpoint}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Request Body</Label>
                <Textarea
                  value={exampleRequest}
                  readOnly
                  className="mt-1 font-mono text-sm"
                  rows={4}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* UI Preview */}
          <Card>
            <CardHeader>
              <CardTitle>UI Preview</CardTitle>
              <CardDescription>How the verification result appears to users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{result.device.deviceName}</h3>
                  <p className="text-sm text-gray-600">
                    {result.device.brand} {result.device.model}
                  </p>
                  <p className="text-xs text-gray-500">
                    Serial: {result.device.serialNumber}
                  </p>
                </div>
                {result.device.imageUrl && (
                  <img
                    src={result.device.imageUrl}
                    alt={result.device.deviceName}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <StatusBadge status={result.device.status} size="lg" />
                <div className="text-right text-xs text-gray-600">
                  <p>Last verified: {new Date(result.device.lastVerified).toLocaleDateString()}</p>
                  {result.reportCount > 0 && (
                    <p className="text-red-600 font-medium">
                      {result.reportCount} report{result.reportCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {result.currentOwner && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{result.currentOwner.ownerAlias}</p>
                      <p className="text-sm text-gray-600 capitalize">{result.currentOwner.ownerType}</p>
                    </div>
                    <Badge variant="default">
                      {result.currentOwner.verificationLevel}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Response */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Response</CardTitle>
                  <CardDescription>Raw JSON response from the API</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={copyApiResponse}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Docs
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={apiResponse}
                readOnly
                className="font-mono text-xs"
                rows={20}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
