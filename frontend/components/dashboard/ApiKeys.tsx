import { useState } from 'react';
import { Key, Copy, Eye, EyeOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  accessLevel: 'read' | 'write' | 'admin';
  created: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk_live_1234567890abcdef',
      accessLevel: 'read',
      created: new Date('2024-01-01'),
      lastUsed: new Date('2024-01-15'),
      isActive: true,
    },
    {
      id: '2',
      name: 'Development Key',
      key: 'sk_test_abcdef1234567890',
      accessLevel: 'write',
      created: new Date('2024-01-10'),
      lastUsed: new Date('2024-01-14'),
      isActive: true,
    },
  ]);

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyAccess, setNewKeyAccess] = useState<'read' | 'write' | 'admin'>('read');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const generateApiKey = () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyName.trim(),
      key: `sk_${newKeyAccess}_${Math.random().toString(36).substr(2, 16)}`,
      accessLevel: newKeyAccess,
      created: new Date(),
      isActive: true,
    };

    setApiKeys(prev => [...prev, newKey]);
    setNewKeyName('');
    setNewKeyAccess('read');
    setShowCreateDialog(false);

    toast({
      title: "API Key Created",
      description: `New ${newKeyAccess} API key "${newKey.name}" has been created`,
    });
  };

  const deleteApiKey = (keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId));
    toast({
      title: "API Key Deleted",
      description: "The API key has been permanently deleted",
    });
  };

  const getAccessBadge = (level: string) => {
    const variants = {
      read: 'secondary',
      write: 'default',
      admin: 'destructive',
    } as const;
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'secondary'}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '••••••••••••••••';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>API Keys</span>
              </CardTitle>
              <CardDescription>
                Manage your API keys for accessing the STOLEN Verification API
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for accessing the verification endpoints
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="access-level">Access Level</Label>
                    <Select value={newKeyAccess} onValueChange={(value: 'read' | 'write' | 'admin') => setNewKeyAccess(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read Only - Verification requests only</SelectItem>
                        <SelectItem value="write">Read/Write - Verification + flagging</SelectItem>
                        <SelectItem value="admin">Admin - Full access including analytics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={generateApiKey}>Create Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Keep your API keys secure and never share them publicly. If a key is compromised, delete it immediately and create a new one.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <Card key={apiKey.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold">{apiKey.name}</h3>
                      {getAccessBadge(apiKey.accessLevel)}
                      {!apiKey.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                        {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {showKeys[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600">
                      Created: {apiKey.created.toLocaleDateString()}
                      {apiKey.lastUsed && (
                        <span className="ml-4">
                          Last used: {apiKey.lastUsed.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteApiKey(apiKey.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {apiKeys.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No API keys created yet. Create your first API key to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>
            Quick reference for using the STOLEN Verification API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Authentication</h4>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                curl -H "Authorization: Bearer YOUR_API_KEY" \<br />
                &nbsp;&nbsp;&nbsp;&nbsp; https://api.stolen-verify.com/verification/verify
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Verify Single Device</h4>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                POST /verification/verify<br />
                {JSON.stringify({
                  identifier: "SN123456789",
                  identifierType: "serial"
                }, null, 2)}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Batch Verification</h4>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                POST /verification/verify/batch<br />
                {JSON.stringify({
                  devices: [
                    { identifier: "SN123456789", identifierType: "serial" },
                    { identifier: "987654321098765", identifierType: "imei" }
                  ]
                }, null, 2)}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Rate Limits</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Read keys: 1000 requests/hour</li>
                <li>• Write keys: 500 requests/hour</li>
                <li>• Admin keys: 2000 requests/hour</li>
                <li>• Batch verification: 100 devices per request</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
