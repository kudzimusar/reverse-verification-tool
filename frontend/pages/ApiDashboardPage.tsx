import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SingleVerification } from '../components/dashboard/SingleVerification';
import { BatchVerification } from '../components/dashboard/BatchVerification';
import { MultiNodeVerification } from '../components/dashboard/MultiNodeVerification';
import { VerificationLogs } from '../components/dashboard/VerificationLogs';
import { UsageAnalytics } from '../components/dashboard/UsageAnalytics';
import { ApiKeys } from '../components/dashboard/ApiKeys';
import { Shield, BarChart3, Key, FileText, Upload, Search, Network } from 'lucide-react';

export function ApiDashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">STOLEN Verification API</h1>
              <p className="text-gray-600">Advanced Partner Console with Multi-Node Verification</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="single" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Single</span>
            </TabsTrigger>
            <TabsTrigger value="multi-node" className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Multi-Node</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Batch</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Keys</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Multi-Node Verifications</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">456</div>
                  <p className="text-xs text-muted-foreground">37% of total verifications</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flagged Devices</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">23</div>
                  <p className="text-xs text-muted-foreground">2.6% of found devices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <p className="text-xs text-muted-foreground">Multi-node consensus</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Verification Features</CardTitle>
                <CardDescription>
                  Explore the enhanced capabilities of the STOLEN Verification API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Network className="h-6 w-6 text-blue-600" />
                      <h3 className="font-semibold">Multi-Node Verification</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Verify devices across multiple independent nodes for enhanced reliability and fraud detection.
                    </p>
                    <button 
                      onClick={() => setActiveTab('multi-node')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Try Multi-Node Verification →
                    </button>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Shield className="h-6 w-6 text-green-600" />
                      <h3 className="font-semibold">AI Trust Scoring</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Dynamic trust assessment based on ownership history, repair records, and dispute patterns.
                    </p>
                    <button 
                      onClick={() => setActiveTab('single')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      View Trust Scores →
                    </button>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <FileText className="h-6 w-6 text-purple-600" />
                      <h3 className="font-semibold">Device Fingerprinting</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Hardware-level identification that works even when serial numbers are tampered with.
                    </p>
                    <button 
                      onClick={() => setActiveTab('single')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Learn About Fingerprinting →
                    </button>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Upload className="h-6 w-6 text-orange-600" />
                      <h3 className="font-semibold">Batch Processing</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload CSV files to verify hundreds of devices simultaneously with detailed reporting.
                    </p>
                    <button 
                      onClick={() => setActiveTab('batch')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Upload Batch File →
                    </button>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <BarChart3 className="h-6 w-6 text-red-600" />
                      <h3 className="font-semibold">Real-time Analytics</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Monitor API usage, success rates, and device verification trends in real-time.
                    </p>
                    <button 
                      onClick={() => setActiveTab('analytics')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      View Analytics →
                    </button>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Key className="h-6 w-6 text-indigo-600" />
                      <h3 className="font-semibold">API Management</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Generate and manage API keys with different access levels and usage monitoring.
                    </p>
                    <button 
                      onClick={() => setActiveTab('api-keys')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Manage API Keys →
                    </button>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="single">
            <SingleVerification />
          </TabsContent>

          <TabsContent value="multi-node">
            <MultiNodeVerification />
          </TabsContent>

          <TabsContent value="batch">
            <BatchVerification />
          </TabsContent>

          <TabsContent value="logs">
            <VerificationLogs />
          </TabsContent>

          <TabsContent value="analytics">
            <UsageAnalytics />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeys />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
