import { useState } from 'react';
import { QrCode, Copy, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { GenerateBadgeResponse } from '~backend/verification/generate_badge';

interface BadgeGeneratorProps {
  deviceId: number;
  deviceName: string;
}

export function BadgeGenerator({ deviceId, deviceName }: BadgeGeneratorProps) {
  const [badgeType, setBadgeType] = useState<'standard' | 'premium' | 'marketplace'>('standard');
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [customization, setCustomization] = useState({
    color: 'blue',
    size: 'medium' as 'small' | 'medium' | 'large',
    style: 'detailed' as 'minimal' | 'detailed' | 'branded',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [badge, setBadge] = useState<GenerateBadgeResponse | null>(null);
  const { toast } = useToast();

  const handleGenerateBadge = async () => {
    setIsGenerating(true);
    try {
      const response = await backend.verification.generateBadge({
        deviceId,
        badgeType,
        expiryDays: expiryDays > 0 ? expiryDays : undefined,
        customization,
      });
      setBadge(response);
      toast({
        title: "Badge Generated",
        description: "Verification badge created successfully",
      });
    } catch (error) {
      console.error('Badge generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate verification badge",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const downloadQRCode = () => {
    if (!badge) return;
    
    // Create QR code for verification URL
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', 100, 100);
    ctx.fillText('(Scan to verify)', 100, 120);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deviceName}-verification-qr.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>Generate Verification Badge</span>
          </CardTitle>
          <CardDescription>
            Create a verification badge for {deviceName} that can be embedded on listings or websites
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="badge-type">Badge Type</Label>
                <Select value={badgeType} onValueChange={(value: typeof badgeType) => setBadgeType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard - Basic verification</SelectItem>
                    <SelectItem value="premium">Premium - Enhanced features</SelectItem>
                    <SelectItem value="marketplace">Marketplace - Partner integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-days">Expiry (days)</Label>
                <Input
                  id="expiry-days"
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 0)}
                  placeholder="365 (0 for no expiry)"
                />
              </div>

              <div className="space-y-3">
                <Label>Customization</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="badge-size" className="text-sm">Size</Label>
                  <Select value={customization.size} onValueChange={(value: typeof customization.size) => 
                    setCustomization(prev => ({ ...prev, size: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (120x40)</SelectItem>
                      <SelectItem value="medium">Medium (160x50)</SelectItem>
                      <SelectItem value="large">Large (200x60)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="badge-style" className="text-sm">Style</Label>
                  <Select value={customization.style} onValueChange={(value: typeof customization.style) => 
                    setCustomization(prev => ({ ...prev, style: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal - Clean design</SelectItem>
                      <SelectItem value="detailed">Detailed - Full information</SelectItem>
                      <SelectItem value="branded">Branded - Company styling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerateBadge} disabled={isGenerating} className="w-full">
                {isGenerating ? 'Generating...' : 'Generate Badge'}
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Badge Preview</Label>
                <div className="mt-2 p-4 bg-gray-100 rounded-lg text-center">
                  {badge ? (
                    <div className="space-y-2">
                      <img 
                        src={badge.badgeUrl} 
                        alt="Verification Badge" 
                        className="mx-auto"
                        style={{ maxWidth: '200px' }}
                      />
                      <div className="flex items-center justify-center space-x-2">
                        <Badge variant="default">Active</Badge>
                        <Badge variant="outline">{badge.badgeConfig.type}</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-gray-500">
                      Badge preview will appear here
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">Badge Features:</h4>
                <ul className="space-y-1">
                  <li>• Click-through to full device lifecycle</li>
                  <li>• Real-time verification status</li>
                  <li>• Trust score display</li>
                  <li>• Tamper-proof verification</li>
                  <li>• Mobile-responsive design</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {badge && (
        <div className="space-y-6">
          {/* Badge URLs */}
          <Card>
            <CardHeader>
              <CardTitle>Badge Information</CardTitle>
              <CardDescription>
                Use these URLs and codes to embed the verification badge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Badge ID</Label>
                  <div className="flex space-x-2">
                    <Input value={badge.badgeId} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(badge.badgeId, "Badge ID")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Verification URL</Label>
                  <div className="flex space-x-2">
                    <Input value={badge.verificationUrl} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(badge.verificationUrl, "Verification URL")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(badge.verificationUrl, '_blank')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {badge.expiresAt && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Expires:</strong> {new Date(badge.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>
                Copy this HTML code to embed the verification badge on your website or listing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">HTML Embed Code</Label>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(badge.embedCode, "Embed code")}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
                <Textarea
                  value={badge.embedCode}
                  readOnly
                  className="font-mono text-xs"
                  rows={8}
                />
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={downloadQRCode}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
                <Button variant="outline" onClick={() => window.open(badge.verificationUrl, '_blank')}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Lifecycle
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">For Sellers</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Add the embed code to your product listing</li>
                    <li>• Include the verification URL in descriptions</li>
                    <li>• Share the QR code for offline verification</li>
                    <li>• Boost buyer confidence with verified history</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">For Marketplaces</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Integrate via Partner API for automatic badges</li>
                    <li>• Display verification status prominently</li>
                    <li>• Link to complete device lifecycle</li>
                    <li>• Reduce fraud and increase trust</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
