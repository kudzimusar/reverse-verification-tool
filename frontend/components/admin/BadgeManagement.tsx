import { useState, useEffect } from 'react';
import { Shield, Plus, Search, Filter, MoreHorizontal, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { VerificationBadge } from '../VerificationBadge';
import backend from '~backend/client';
import type { BadgeStats } from '~backend/verification/badge_lifecycle';

export function BadgeManagement() {
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ id: number; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [createForm, setCreateForm] = useState({
    entityId: '',
    verifiedBy: '',
    verificationMethod: 'manual' as 'manual' | 'automated' | 'third_party',
    expiryDate: '',
    notes: '',
  });

  const [revokeForm, setRevokeForm] = useState({
    reason: '',
    revokedBy: '',
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await backend.verification.getBadgeStats({ limit: 10 });
      setStats(response.stats);
    } catch (error) {
      console.error('Load stats error:', error);
      toast({
        title: "Error",
        description: "Failed to load badge statistics",
        variant: "destructive",
      });
    }
  };

  const handleCreateBadge = async () => {
    if (!createForm.entityId || !createForm.verifiedBy) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await backend.verification.createBadge({
        entityId: parseInt(createForm.entityId),
        verifiedBy: createForm.verifiedBy,
        verificationMethod: createForm.verificationMethod,
        expiryDate: createForm.expiryDate ? new Date(createForm.expiryDate) : undefined,
        notes: createForm.notes || undefined,
      });

      toast({
        title: "Badge Created",
        description: "Verification badge has been created successfully",
      });

      setShowCreateDialog(false);
      setCreateForm({
        entityId: '',
        verifiedBy: '',
        verificationMethod: 'manual',
        expiryDate: '',
        notes: '',
      });
      loadStats();
    } catch (error) {
      console.error('Create badge error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create verification badge",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeBadge = async () => {
    if (!selectedEntity || !revokeForm.reason || !revokeForm.revokedBy) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await backend.verification.revokeBadge({
        entityId: selectedEntity.id,
        revokedBy: revokeForm.revokedBy,
        reason: revokeForm.reason,
      });

      toast({
        title: "Badge Revoked",
        description: `Verification badge for ${selectedEntity.name} has been revoked`,
      });

      setShowRevokeDialog(false);
      setSelectedEntity(null);
      setRevokeForm({ reason: '', revokedBy: '' });
      loadStats();
    } catch (error) {
      console.error('Revoke badge error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke verification badge",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'revoked':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Badge Management</span>
              </CardTitle>
              <CardDescription>
                Manage verification badges and view lifecycle statistics
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Badge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Verification Badge</DialogTitle>
                  <DialogDescription>
                    Grant verification status to an entity
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entity-id">Entity ID *</Label>
                    <Input
                      id="entity-id"
                      type="number"
                      placeholder="Enter entity/device ID"
                      value={createForm.entityId}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, entityId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verified-by">Verified By *</Label>
                    <Input
                      id="verified-by"
                      placeholder="Enter verifier name/ID"
                      value={createForm.verifiedBy}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, verifiedBy: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verification-method">Verification Method</Label>
                    <Select 
                      value={createForm.verificationMethod} 
                      onValueChange={(value: 'manual' | 'automated' | 'third_party') => 
                        setCreateForm(prev => ({ ...prev, verificationMethod: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Review</SelectItem>
                        <SelectItem value="automated">Automated System</SelectItem>
                        <SelectItem value="third_party">Third Party Verification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry-date">Expiry Date (Optional)</Label>
                    <Input
                      id="expiry-date"
                      type="date"
                      value={createForm.expiryDate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional verification notes..."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateBadge} disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Badge'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistics Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalBadges}</div>
                <div className="text-sm text-blue-700">Total Badges</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.verifiedCount}</div>
                <div className="text-sm text-green-700">Verified</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.revokedCount}</div>
                <div className="text-sm text-red-700">Revoked</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.expiredCount}</div>
                <div className="text-sm text-gray-700">Expired</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by entity name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recent Verifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Verifications</CardTitle>
              <CardDescription>
                Latest verification badges issued
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && stats.recentVerifications.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentVerifications.map((verification, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <VerificationBadge 
                          entityId={verification.entityId} 
                          entityName={verification.entityName}
                          showLifecycleButton={false}
                          size="sm"
                        />
                        <div>
                          <h4 className="font-semibold">{verification.entityName}</h4>
                          <p className="text-sm text-gray-600">ID: {verification.entityId}</p>
                          <p className="text-sm text-gray-600">
                            Verified by {verification.verifiedBy} on {formatDate(verification.issuedAt)}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEntity({
                                id: verification.entityId,
                                name: verification.entityName,
                              });
                              setShowRevokeDialog(true);
                            }}
                          >
                            Revoke Badge
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent verifications found
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Revoke Badge Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Verification Badge</DialogTitle>
            <DialogDescription>
              Revoke verification status for {selectedEntity?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="revoked-by">Revoked By *</Label>
              <Input
                id="revoked-by"
                placeholder="Enter your name/ID"
                value={revokeForm.revokedBy}
                onChange={(e) => setRevokeForm(prev => ({ ...prev, revokedBy: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revoke-reason">Reason for Revocation *</Label>
              <Textarea
                id="revoke-reason"
                placeholder="Explain why this badge is being revoked..."
                value={revokeForm.reason}
                onChange={(e) => setRevokeForm(prev => ({ ...prev, reason: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeBadge} disabled={isLoading}>
              {isLoading ? 'Revoking...' : 'Revoke Badge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
