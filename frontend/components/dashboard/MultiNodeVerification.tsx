import { useState } from 'react';
import { Network, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { MultiNodeVerificationResponse } from '~backend/verification/multi_node_verification';

export function MultiNodeVerification() {
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'serial' | 'imei'>('serial');
  const [requiredNodes, setRequiredNodes] = useState(3);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<MultiNodeVerificationResponse | null>(null);
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

    setIsVerifying(true);
    try {
      const response = await backend.verification.multiNodeVerify({
        identifier: identifier.trim(),
        identifierType,
        requiredNodes,
      });
      setResult(response);
      
      toast({
        title: "Multi-Node Verification Complete",
        description: `Consensus: ${response.consensus.verified ? 'Verified' : 'Not Verified'} (${response.consensus.confidence}% confidence)`,
      });
    } catch (error) {
      console.error('Multi-node verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Multi-node verification failed",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNodeStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default">Success</Badge>;
      case 'failure':
        return <Badge variant="destructive">Failed</Badge>;
      case 'timeout':
        return <Badge variant="secondary">Timeout</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Multi-Node Verification</span>
          </CardTitle>
          <CardDescription>
            Verify devices across multiple independent nodes for enhanced reliability and fraud detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <div className="space-y-2">
                <Label htmlFor="required-nodes">Required Node Agreement</Label>
                <Select value={requiredNodes.toString()} onValueChange={(value) => setRequiredNodes(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Nodes (Minimum)</SelectItem>
                    <SelectItem value="3">3 Nodes (Recommended)</SelectItem>
                    <SelectItem value="4">4 Nodes (High Security)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleVerify} disabled={isVerifying} className="w-full">
                {isVerifying ? 'Verifying Across Nodes...' : 'Start Multi-Node Verification'}
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Verification Network</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>STOLEN Primary Node</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Police Database Node</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Insurance Registry Node</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Manufacturer Node</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">How Multi-Node Verification Works:</h4>
                <ul className="space-y-1">
                  <li>• Queries multiple independent verification sources</li>
                  <li>• Requires consensus from specified number of nodes</li>
                  <li>• Provides confidence score based on agreement</li>
                  <li>• Detects and prevents single-point-of-failure attacks</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          {/* Consensus Results */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Consensus</CardTitle>
              <CardDescription>
                Results from multi-node verification for {result.identifier}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.consensus.verified ? 'VERIFIED' : 'NOT VERIFIED'}
                  </div>
                  <div className="text-sm text-blue-700">Consensus Result</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className={`text-2xl font-bold ${getConfidenceColor(result.consensus.confidence)}`}>
                    {result.consensus.confidence}%
                  </div>
                  <div className="text-sm text-green-700">Confidence</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.consensus.agreementCount}/{result.consensus.totalNodes}
                  </div>
                  <div className="text-sm text-purple-700">Node Agreement</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.nodeResponses.length}
                  </div>
                  <div className="text-sm text-orange-700">Nodes Queried</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Consensus Strength</span>
                  <span>{result.consensus.confidence}%</span>
                </div>
                <Progress value={result.consensus.confidence} className="w-full" />
              </div>

              {result.device && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Verified Device Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Device:</span> {result.device.deviceName}</p>
                    <p><span className="font-medium">Serial:</span> {result.device.serialNumber}</p>
                    <p><span className="font-medium">Status:</span> {result.device.status}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Node Responses */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Node Responses</CardTitle>
              <CardDescription>
                Detailed responses from each verification node
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.nodeResponses.map((nodeResponse, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getNodeStatusIcon(nodeResponse.status)}
                        <div>
                          <h4 className="font-semibold">{nodeResponse.nodeName}</h4>
                          <p className="text-sm text-gray-600">Response Time: {nodeResponse.responseTime}ms</p>
                        </div>
                      </div>
                      {getNodeStatusBadge(nodeResponse.status)}
                    </div>

                    {nodeResponse.status === 'success' && nodeResponse.data && (
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-sm">
                          <p><span className="font-medium">Found:</span> {nodeResponse.data.found ? 'Yes' : 'No'}</p>
                          {nodeResponse.data.device && (
                            <div className="mt-2">
                              <p><span className="font-medium">Device Status:</span> {nodeResponse.data.device.status}</p>
                              {nodeResponse.data.device.source && (
                                <p><span className="font-medium">Source:</span> {nodeResponse.data.device.source}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {nodeResponse.error && (
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Error:</span> {nodeResponse.error}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Request Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><span className="font-medium">Request ID:</span> {result.requestId}</p>
                  <p><span className="font-medium">Identifier:</span> {result.identifier}</p>
                  <p><span className="font-medium">Type:</span> {result.identifierType.toUpperCase()}</p>
                </div>
                <div>
                  <p><span className="font-medium">Required Nodes:</span> {requiredNodes}</p>
                  <p><span className="font-medium">Successful Responses:</span> {result.nodeResponses.filter(r => r.status === 'success').length}</p>
                  <p><span className="font-medium">Failed Responses:</span> {result.nodeResponses.filter(r => r.status !== 'success').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
