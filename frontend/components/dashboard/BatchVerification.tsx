import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { StatusBadge } from '../StatusBadge';
import backend from '~backend/client';
import type { BatchVerifyResponse } from '~backend/verification/batch_verify';

export function BatchVerification() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchVerifyResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseCsvFile = (csvContent: string) => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const devices = [];
    
    // Skip header row if it exists
    const startIndex = lines[0].toLowerCase().includes('identifier') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const [identifier, identifierType] = lines[i].split(',').map(cell => cell.trim());
      if (identifier && identifierType) {
        devices.push({
          identifier,
          identifierType: identifierType.toLowerCase() as 'serial' | 'imei',
        });
      }
    }
    
    return devices;
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const csvContent = await file.text();
      const devices = parseCsvFile(csvContent);

      if (devices.length === 0) {
        throw new Error("No valid devices found in CSV file");
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await backend.verification.batchVerify({ devices });
      
      clearInterval(progressInterval);
      setProgress(100);
      setResults(response);

      toast({
        title: "Batch Verification Complete",
        description: `Processed ${response.totalProcessed} devices, found ${response.totalFound}`,
      });
    } catch (error) {
      console.error('Batch verification error:', error);
      toast({
        title: "Batch Verification Failed",
        description: error instanceof Error ? error.message : "Failed to process batch verification",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSampleCsv = () => {
    const sampleCsv = `identifier,identifierType
SN123456789,serial
987654321098765,imei
SN987654321,serial`;
    
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_devices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    if (!results) return;

    const csvContent = [
      'identifier,identifierType,found,deviceName,brand,model,status,reportCount',
      ...results.results.map(result => [
        result.identifier,
        result.identifierType,
        result.found,
        result.device?.deviceName || '',
        result.device?.brand || '',
        result.device?.model || '',
        result.device?.status || '',
        result.reportCount || 0,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verification_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Batch Device Verification</span>
          </CardTitle>
          <CardDescription>
            Upload a CSV file to verify multiple devices at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              CSV format: Each row should contain 'identifier,identifierType' where identifierType is either 'serial' or 'imei'
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </div>

              {file && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              <div className="flex space-x-2">
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Upload & Verify'}
                </Button>
                <Button variant="outline" onClick={downloadSampleCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Sample CSV
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">CSV Format Example</Label>
                <div className="mt-1 p-3 bg-gray-100 rounded-md font-mono text-sm">
                  identifier,identifierType<br />
                  SN123456789,serial<br />
                  987654321098765,imei<br />
                  SN987654321,serial
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">Supported Identifier Types:</h4>
                <ul className="space-y-1">
                  <li>• <code>serial</code> - Device serial number</li>
                  <li>• <code>imei</code> - International Mobile Equipment Identity</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Verification Results</CardTitle>
                <CardDescription>
                  {results.totalFound} of {results.totalProcessed} devices found
                </CardDescription>
              </div>
              <Button variant="outline" onClick={downloadResults}>
                <Download className="h-4 w-4 mr-2" />
                Download Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.totalFound}</div>
                  <div className="text-sm text-green-700">Devices Found</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {results.totalProcessed - results.totalFound}
                  </div>
                  <div className="text-sm text-red-700">Not Found</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((results.totalFound / results.totalProcessed) * 100)}%
                  </div>
                  <div className="text-sm text-blue-700">Success Rate</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Identifier</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Device</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Reports</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.results.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-mono">{result.identifier}</td>
                          <td className="px-4 py-2 text-sm">{result.identifierType}</td>
                          <td className="px-4 py-2">
                            {result.found ? (
                              result.device && <StatusBadge status={result.device.status} />
                            ) : (
                              <Badge variant="secondary">Not Found</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {result.device ? (
                              <div>
                                <div className="font-medium">{result.device.deviceName}</div>
                                <div className="text-gray-600">{result.device.brand} {result.device.model}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {result.reportCount ? (
                              <Badge variant="destructive">{result.reportCount}</Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
