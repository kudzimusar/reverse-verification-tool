import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, Shield, Wrench, FileText, DollarSign, AlertTriangle, CheckCircle, Clock, ExternalLink, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '../components/StatusBadge';
import { TrustScoreDisplay } from '../components/TrustScoreDisplay';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { GetLifecycleResponse } from '~backend/verification/lifecycle';

export function LifecyclePage() {
  const { badgeId } = useParams<{ badgeId: string }>();
  const [lifecycle, setLifecycle] = useState<GetLifecycleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadLifecycle = async () => {
      if (!badgeId) return;

      try {
        const response = await backend.verification.getLifecycle({ badgeId });
        setLifecycle(response);
      } catch (error) {
        console.error('Load lifecycle error:', error);
        toast({
          title: "Error",
          description: "Failed to load device lifecycle information",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadLifecycle();
  }, [badgeId, toast]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getEventIcon = (category: string) => {
    switch (category) {
      case 'ownership':
        return <Shield className="h-4 w-4" />;
      case 'repair':
        return <Wrench className="h-4 w-4" />;
      case 'insurance':
        return <FileText className="h-4 w-4" />;
      case 'warranty':
        return <CheckCircle className="h-4 w-4" />;
      case 'police':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getVerificationBadge = (level: string) => {
    const variants = {
      verified: 'default',
      unverified: 'secondary',
      disputed: 'destructive',
    } as const;
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'secondary'} className="text-xs">
        {level}
      </Badge>
    );
  };

  const shareLifecycle = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `${lifecycle?.device.name} - Device Verification`,
        text: 'Check out this verified device lifecycle',
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied",
        description: "Lifecycle link copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading device lifecycle...</p>
        </div>
      </div>
    );
  }

  if (!lifecycle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Lifecycle Not Found</h2>
            <p className="text-gray-600">The requested device lifecycle could not be found or the link has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { device, currentOwner, lifecycle: lifecycleData, badge } = lifecycle;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Device Lifecycle Verification</h1>
                <p className="text-gray-600">Complete ownership and maintenance history</p>
              </div>
            </div>
            <Button variant="outline" onClick={shareLifecycle}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Device Summary */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-3xl">{device.name}</CardTitle>
                <CardDescription className="text-lg">
                  {device.brand} {device.model} • Serial: {device.serialNumber}
                </CardDescription>
              </div>
              {device.imageUrl && (
                <img
                  src={device.imageUrl}
                  alt={device.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <StatusBadge status={device.status} size="lg" />
                {device.trustScore && (
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    Trust Score: {device.trustScore}%
                  </Badge>
                )}
              </div>
              {badge && (
                <div className="text-right text-sm text-gray-600">
                  <p>Badge Type: {badge.type}</p>
                  <p>Views: {badge.clickCount}</p>
                  <p>Created: {formatDate(badge.createdAt)}</p>
                </div>
              )}
            </div>

            {/* Lifecycle Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{lifecycleData.summary.ownershipChanges}</div>
                <div className="text-sm text-blue-700">Owners</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{lifecycleData.summary.repairCount}</div>
                <div className="text-sm text-green-700">Repairs</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {lifecycleData.warranties.filter(w => w.isActive).length}
                </div>
                <div className="text-sm text-purple-700">Active Warranties</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{lifecycleData.summary.insuranceClaims}</div>
                <div className="text-sm text-orange-700">Insurance Claims</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{lifecycleData.summary.policeReports}</div>
                <div className="text-sm text-red-700">Police Reports</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Owner */}
        {currentOwner && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Current Owner</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{currentOwner.alias}</h3>
                  <p className="text-gray-600 capitalize">{currentOwner.type}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Owner since {formatDate(currentOwner.since)}</span>
                    </div>
                    {currentOwner.location && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{currentOwner.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="default" className="text-sm">
                  {currentOwner.verificationLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Lifecycle Tabs */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="repairs">Repairs</TabsTrigger>
            <TabsTrigger value="warranties">Warranties</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Complete Event Timeline</CardTitle>
                <CardDescription>
                  Chronological history of all recorded events for this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.events.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No events recorded</p>
                  ) : (
                    lifecycleData.events.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            {getEventIcon(event.category)}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold capitalize">{event.category.replace('_', ' ')}</h4>
                              <div className="flex items-center space-x-2">
                                {getVerificationBadge(event.verificationLevel)}
                                <span className="text-sm text-gray-600">
                                  {formatDate(event.timestamp)}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">Source: {event.source}</p>
                            {event.data && (
                              <div className="text-sm bg-gray-50 p-3 rounded-md">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(event.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                        {index < lifecycleData.events.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ownership" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ownership History</CardTitle>
                <CardDescription>
                  Complete chain of ownership for this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.ownership.map((owner, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-semibold">{owner.owner}</h4>
                        <p className="text-sm text-gray-600 capitalize">{owner.type}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>From: {formatDate(owner.from)}</span>
                          {owner.to && <span>To: {formatDate(owner.to)}</span>}
                          {owner.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{owner.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline">{owner.verificationLevel}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repairs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Repair History</CardTitle>
                <CardDescription>
                  All recorded repairs and maintenance for this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.repairs.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No repairs recorded</p>
                  ) : (
                    lifecycleData.repairs.map((repair, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{repair.shop}</h4>
                            <p className="text-sm text-gray-600 capitalize">{repair.type} repair</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2">
                              {repair.authorized && (
                                <Badge variant="default" className="text-xs">Authorized</Badge>
                              )}
                              <span className="text-sm text-gray-600">
                                {formatDate(repair.date)}
                              </span>
                            </div>
                            {repair.cost && (
                              <p className="text-sm font-medium">{formatCurrency(repair.cost)}</p>
                            )}
                          </div>
                        </div>
                        {repair.description && (
                          <p className="text-sm text-gray-700 mb-2">{repair.description}</p>
                        )}
                        {repair.warranty > 0 && (
                          <p className="text-sm text-blue-600">
                            Warranty: {repair.warranty} days
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warranties" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Warranty Information</CardTitle>
                <CardDescription>
                  Current and historical warranty coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.warranties.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No warranties recorded</p>
                  ) : (
                    lifecycleData.warranties.map((warranty, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <h4 className="font-semibold">{warranty.provider}</h4>
                            <p className="text-sm text-gray-600 capitalize">{warranty.type} warranty</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>Start: {formatDate(warranty.startDate)}</span>
                              <span>End: {formatDate(warranty.endDate)}</span>
                            </div>
                            {warranty.claimCount > 0 && (
                              <p className="text-sm text-orange-600">
                                Claims filed: {warranty.claimCount}
                              </p>
                            )}
                          </div>
                          <Badge variant={warranty.isActive ? "default" : "secondary"}>
                            {warranty.isActive ? "Active" : "Expired"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Insurance Records</CardTitle>
                <CardDescription>
                  Insurance coverage and claims history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.insurance.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No insurance records</p>
                  ) : (
                    lifecycleData.insurance.map((insurance, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-2">
                            <h4 className="font-semibold">{insurance.provider}</h4>
                            {insurance.policyNumber && (
                              <p className="text-sm text-gray-600">Policy: {insurance.policyNumber}</p>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>Start: {formatDate(insurance.startDate)}</span>
                              {insurance.endDate && (
                                <span>End: {formatDate(insurance.endDate)}</span>
                              )}
                            </div>
                            {insurance.coverage && (
                              <p className="text-sm font-medium text-green-600">
                                Coverage: {formatCurrency(insurance.coverage)}
                              </p>
                            )}
                          </div>
                          <Badge variant={insurance.isActive ? "default" : "secondary"}>
                            {insurance.isActive ? "Active" : "Expired"}
                          </Badge>
                        </div>
                        {insurance.claims.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <h5 className="font-medium text-sm mb-2">Claims History:</h5>
                            <div className="space-y-1">
                              {insurance.claims.map((claim: any, claimIndex: number) => (
                                <div key={claimIndex} className="text-sm text-gray-600">
                                  {claim.date}: {claim.description} - {formatCurrency(claim.amount)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trust Score */}
        {device.trustScore && (
          <div className="mt-8">
            <TrustScoreDisplay 
              trustScore={{
                score: device.trustScore,
                riskCategory: device.trustScore >= 80 ? "low" : device.trustScore >= 50 ? "medium" : "high",
                components: {
                  ownershipContinuity: Math.min(30, lifecycleData.summary.ownershipChanges * 5),
                  historyCompleteness: Math.min(25, lifecycleData.summary.totalEvents * 3),
                  repairHistory: Math.max(0, 20 - lifecycleData.summary.repairCount * 2),
                  disputePenalty: lifecycleData.summary.policeReports * -10,
                },
                lastCalculated: new Date(),
              }}
            />
          </div>
        )}

        {/* Footer */}
        <Card className="mt-8 bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Verified by STOLEN</p>
                <p className="text-sm text-gray-600">
                  This lifecycle report is generated from verified data sources and blockchain-secured records. 
                  All information is tamper-proof and independently verifiable. Data accuracy depends on reporting by owners, 
                  service providers, and authorized partners.
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Access ID: {lifecycle.accessMetadata.accessId}</span>
                  <span>Generated: {formatDate(lifecycle.accessMetadata.timestamp)}</span>
                  <a href="https://stolen-verify.app" className="flex items-center space-x-1 text-blue-600 hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    <span>Learn more about STOLEN</span>
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
