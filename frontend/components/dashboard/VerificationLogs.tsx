import { useState, useEffect } from 'react';
import { FileText, Filter, Download, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface VerificationLog {
  id: number;
  timestamp: Date;
  identifier: string;
  identifierType: 'serial' | 'imei';
  result: 'found' | 'not_found' | 'error';
  deviceName?: string;
  ipAddress: string;
}

export function VerificationLogs() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<VerificationLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const mockLogs: VerificationLog[] = [
      {
        id: 1,
        timestamp: new Date('2024-01-15T10:30:00'),
        identifier: 'SN123456789',
        identifierType: 'serial',
        result: 'found',
        deviceName: 'iPhone 14 Pro',
        ipAddress: '192.168.1.100',
      },
      {
        id: 2,
        timestamp: new Date('2024-01-15T10:25:00'),
        identifier: '987654321098765',
        identifierType: 'imei',
        result: 'found',
        deviceName: 'Samsung Galaxy S23',
        ipAddress: '192.168.1.101',
      },
      {
        id: 3,
        timestamp: new Date('2024-01-15T10:20:00'),
        identifier: 'SN999999999',
        identifierType: 'serial',
        result: 'not_found',
        ipAddress: '192.168.1.102',
      },
      {
        id: 4,
        timestamp: new Date('2024-01-15T10:15:00'),
        identifier: 'SN456789123',
        identifierType: 'serial',
        result: 'found',
        deviceName: 'Google Pixel 7',
        ipAddress: '192.168.1.103',
      },
      {
        id: 5,
        timestamp: new Date('2024-01-15T10:10:00'),
        identifier: 'INVALID123',
        identifierType: 'serial',
        result: 'error',
        ipAddress: '192.168.1.104',
      },
    ];
    setLogs(mockLogs);
    setFilteredLogs(mockLogs);
  }, []);

  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.includes(searchTerm)
      );
    }

    if (resultFilter !== 'all') {
      filtered = filtered.filter(log => log.result === resultFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(log => log.identifierType === typeFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, resultFilter, typeFilter]);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'found':
        return <Badge variant="default">Found</Badge>;
      case 'not_found':
        return <Badge variant="secondary">Not Found</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Identifier,Type,Result,Device Name,IP Address',
      ...filteredLogs.map(log => [
        log.timestamp.toISOString(),
        log.identifier,
        log.identifierType,
        log.result,
        log.deviceName || '',
        log.ipAddress,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verification_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Verification Logs</span>
              </CardTitle>
              <CardDescription>
                View and filter your verification request history
              </CardDescription>
            </div>
            <Button variant="outline" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by identifier, device name, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="found">Found</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="serial">Serial</SelectItem>
                <SelectItem value="imei">IMEI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{filteredLogs.length}</div>
              <div className="text-sm text-blue-700">Total Requests</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {filteredLogs.filter(log => log.result === 'found').length}
              </div>
              <div className="text-sm text-green-700">Found</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-600">
                {filteredLogs.filter(log => log.result === 'not_found').length}
              </div>
              <div className="text-sm text-gray-700">Not Found</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">
                {filteredLogs.filter(log => log.result === 'error').length}
              </div>
              <div className="text-sm text-red-700">Errors</div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Timestamp</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Identifier</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Result</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Device</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {log.timestamp.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono">{log.identifier}</td>
                      <td className="px-4 py-2 text-sm">
                        <Badge variant="outline">{log.identifierType.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-2">{getResultBadge(log.result)}</td>
                      <td className="px-4 py-2 text-sm">
                        {log.deviceName || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-600">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No verification logs found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
