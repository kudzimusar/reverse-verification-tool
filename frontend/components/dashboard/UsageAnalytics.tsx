import { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function UsageAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data - in real app, this would come from API
  const stats = {
    totalVerifications: 1234,
    successRate: 72.3,
    avgResponseTime: 245,
    peakHour: '14:00',
  };

  const dailyData = [
    { date: '2024-01-09', verifications: 45, found: 32 },
    { date: '2024-01-10', verifications: 67, found: 48 },
    { date: '2024-01-11', verifications: 89, found: 65 },
    { date: '2024-01-12', verifications: 123, found: 89 },
    { date: '2024-01-13', verifications: 156, found: 112 },
    { date: '2024-01-14', verifications: 134, found: 97 },
    { date: '2024-01-15', verifications: 178, found: 128 },
  ];

  const deviceTypes = [
    { type: 'iPhone', count: 456, percentage: 37 },
    { type: 'Samsung Galaxy', count: 234, percentage: 19 },
    { type: 'Google Pixel', count: 123, percentage: 10 },
    { type: 'OnePlus', count: 89, percentage: 7 },
    { type: 'Other', count: 332, percentage: 27 },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Usage Analytics</span>
              </CardTitle>
              <CardDescription>
                Monitor your API usage and performance metrics
              </CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.totalVerifications.toLocaleString()}</div>
              <div className="text-sm text-blue-700">Total Verifications</div>
              <div className="text-xs text-blue-600 mt-1">+12% vs last period</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
              <div className="text-sm text-green-700">Success Rate</div>
              <div className="text-xs text-green-600 mt-1">+2.1% vs last period</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{stats.avgResponseTime}ms</div>
              <div className="text-sm text-purple-700">Avg Response Time</div>
              <div className="text-xs text-purple-600 mt-1">-15ms vs last period</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats.peakHour}</div>
              <div className="text-sm text-orange-700">Peak Usage Hour</div>
              <div className="text-xs text-orange-600 mt-1">UTC timezone</div>
            </div>
          </div>

          {/* Daily Verification Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Verification Trends</CardTitle>
              <CardDescription>Verification requests and success rates over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dailyData.map((day, index) => {
                  const successRate = Math.round((day.found / day.verifications) * 100);
                  return (
                    <div key={day.date} className="flex items-center space-x-4">
                      <div className="w-20 text-sm text-gray-600">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{day.verifications} verifications</span>
                          <span className="text-sm text-gray-600">{successRate}% success</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full relative"
                            style={{ width: `${(day.verifications / Math.max(...dailyData.map(d => d.verifications))) * 100}%` }}
                          >
                            <div 
                              className="bg-green-500 h-2 rounded-full absolute top-0 left-0"
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Device Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Most Verified Device Types</CardTitle>
              <CardDescription>Breakdown of device brands and models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deviceTypes.map((device) => (
                  <div key={device.type} className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium">{device.type}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{device.count} devices</span>
                        <span className="text-sm font-medium">{device.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${device.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
