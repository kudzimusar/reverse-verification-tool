import { useState } from 'react';
import backend from '~backend/client';
import type { AdvancedSearchResponse } from '~backend/verification/advanced_search';
import { Header } from '../components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrustScoreDisplay } from '../components/TrustScoreDisplay';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

export function AdvancedSearchPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [minTrustScore, setMinTrustScore] = useState<number>();
  const [maxTrustScore, setMaxTrustScore] = useState<number>();
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<AdvancedSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const search = async (currentPage = 1) => {
    setLoading(true);
    try {
      const result = await backend.verification.advancedSearch({
        query: query || undefined,
        status: status.length > 0 ? status : undefined,
        minTrustScore,
        maxTrustScore,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 20,
      });
      setResults(result);
      setPage(currentPage);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to search devices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (s: string) => {
    setStatus(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Advanced Search</h1>
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {showFilters && (
            <Card className="p-6 lg:col-span-1 h-fit">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['verified', 'flagged', 'reported', 'stolen', 'pending'].map(s => (
                      <Badge
                        key={s}
                        variant={status.includes(s) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Min Trust Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={minTrustScore || ''}
                    onChange={(e) => setMinTrustScore(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Max Trust Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={maxTrustScore || ''}
                    onChange={(e) => setMaxTrustScore(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="100"
                  />
                </div>

                <div>
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_at">Last Updated</SelectItem>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="trust_score">Trust Score</SelectItem>
                      <SelectItem value="verification_count">Verifications</SelectItem>
                      <SelectItem value="report_count">Reports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sort Order</Label>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
            <Card className="p-6 mb-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by IMEI, manufacturer, or model..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                />
                <Button onClick={() => search()} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </Card>

            {results && (
              <>
                <div className="mb-4 flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Found {results.total} device(s) • Page {results.page} of {results.totalPages}
                  </p>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => search(page - 1)}
                      disabled={page === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => search(page + 1)}
                      disabled={page >= results.totalPages || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {results.devices.map((device) => (
                    <Card
                      key={device.id}
                      className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/device/${device.id}`)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{device.imei}</h3>
                          <p className="text-sm text-muted-foreground">
                            {device.manufacturer} {device.model}
                          </p>
                        </div>
                        <Badge variant={
                          device.status === 'verified' ? 'default' :
                          device.status === 'flagged' || device.status === 'reported' ? 'destructive' :
                          'secondary'
                        }>
                          {device.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Trust Score</p>
                          <TrustScoreDisplay score={device.trustScore} size="sm" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Verifications</p>
                          <p className="font-semibold">{device.verificationCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Reports</p>
                          <p className="font-semibold">{device.reportCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Watchers</p>
                          <p className="font-semibold">{device.watcherCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Last Verified</p>
                          <p className="text-xs">
                            {device.lastVerified ? new Date(device.lastVerified).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                      </div>

                      {device.flaggedReason && (
                        <div className="mt-3 p-2 bg-destructive/10 rounded-md">
                          <p className="text-xs font-medium text-destructive">{device.flaggedReason}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
