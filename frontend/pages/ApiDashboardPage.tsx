import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SingleVerification } from '../components/dashboard/SingleVerification';
import { BatchVerification } from '../components/dashboard/BatchVerification';
import { VerificationLogs } from '../components/dashboard/VerificationLogs';
import { UsageAnalytics } from '../components/dashboard/UsageAnalytics';
import { ApiKeys } from '../components/dashboard/ApiKeys';
import { Shield, BarChart3, Key, FileText, Upload, Search } from 'lucide-react';

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
              <p className="text-gray-600">Partner Console</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="single" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Single Verify</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Batch Verify</span>
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
              <span className="hidden sm:inline">API Keys</span>
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
                  <CardTitle className="text-sm font-medium">Devices Found</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">892</div>
                  <p className="text-xs text-muted-foreground">72% success rate</p>
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
                  <CardTitle className="text-sm font-medium">API Calls Today</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">Within rate limits</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>
                  Get started with the STOLEN Verification API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">1. Get API Key</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Generate your API key to start making verification requests.
                    </p>
                    <button 
                      onClick={() => setActiveTab('api-keys')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Manage API Keys →
                    </button>
                  </Card>
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">2. Test Single Verification</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Try verifying a device using our interactive tool.
                    </p>
                    <button 
                      onClick={() => setActiveTab('single')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Try Single Verify →
                    </button>
                  </Card>
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">3. Batch Upload</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload multiple devices for bulk verification.
                    </p>
                    <button 
                      onClick={() => setActiveTab('batch')}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Upload CSV →
                    </button>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="single">
            <SingleVerification />
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
