import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface WatchDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: number;
  deviceName: string;
}

export function WatchDeviceDialog({ open, onOpenChange, deviceId, deviceName }: WatchDeviceDialogProps) {
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!userEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (smsNotifications && !userPhone.trim()) {
      toast({
        title: "Error",
        description: "Please enter your phone number for SMS notifications",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await backend.verification.watchDevice({
        deviceId,
        userEmail: userEmail.trim(),
        userPhone: userPhone.trim() || undefined,
        notificationPreferences: {
          email: emailNotifications,
          sms: smsNotifications,
          push: pushNotifications,
        },
      });

      toast({
        title: "Device Watch Created",
        description: `You will be notified of any changes to "${deviceName}"`,
      });

      onOpenChange(false);
      setUserEmail('');
      setUserPhone('');
      setEmailNotifications(true);
      setSmsNotifications(false);
      setPushNotifications(false);
    } catch (error) {
      console.error('Watch device error:', error);
      toast({
        title: "Error",
        description: "Failed to create device watch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watch Device</DialogTitle>
          <DialogDescription>
            Get notified when the status or trust score of "{deviceName}" changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">Email Address *</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="Enter your email address"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-phone">Phone Number (optional)</Label>
            <Input
              id="user-phone"
              type="tel"
              placeholder="Enter your phone number"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Notification Preferences</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={(checked) => setEmailNotifications(checked as boolean)}
              />
              <Label htmlFor="email-notifications" className="text-sm">
                Email notifications
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms-notifications"
                checked={smsNotifications}
                onCheckedChange={(checked) => setSmsNotifications(checked as boolean)}
              />
              <Label htmlFor="sms-notifications" className="text-sm">
                SMS notifications
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="push-notifications"
                checked={pushNotifications}
                onCheckedChange={(checked) => setPushNotifications(checked as boolean)}
              />
              <Label htmlFor="push-notifications" className="text-sm">
                Push notifications (coming soon)
              </Label>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              You'll be notified when:
            </p>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Device status changes (clean → flagged)</li>
              <li>• Trust score drops significantly (&gt;15 points)</li>
              <li>• New reports are filed against the device</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating Watch...' : 'Watch Device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
