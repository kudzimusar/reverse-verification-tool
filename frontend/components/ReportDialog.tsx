import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: number;
  deviceName: string;
}

export function ReportDialog({ open, onOpenChange, deviceId, deviceName }: ReportDialogProps) {
  const [reporterAlias, setReporterAlias] = useState('');
  const [reportType, setReportType] = useState<'stolen' | 'fraud' | 'tampered' | 'fake' | 'other'>('stolen');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reporterAlias.trim() || !description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await backend.verification.report({
        deviceId,
        reporterAlias: reporterAlias.trim(),
        reportType,
        description: description.trim(),
      });

      toast({
        title: "Report Submitted",
        description: "Your report has been submitted successfully and will be reviewed.",
      });

      onOpenChange(false);
      setReporterAlias('');
      setDescription('');
      setReportType('stolen');
    } catch (error) {
      console.error('Report submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
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
          <DialogTitle>Report Device</DialogTitle>
          <DialogDescription>
            Report suspicious activity or issues with {deviceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reporter-alias">Your Name/Alias *</Label>
            <Input
              id="reporter-alias"
              placeholder="Enter your name or alias"
              value={reporterAlias}
              onChange={(e) => setReporterAlias(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type *</Label>
            <Select value={reportType} onValueChange={(value: typeof reportType) => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stolen">Stolen Device</SelectItem>
                <SelectItem value="fraud">Fraudulent Listing</SelectItem>
                <SelectItem value="tampered">Tampered Serial/IMEI</SelectItem>
                <SelectItem value="fake">Counterfeit Device</SelectItem>
                <SelectItem value="other">Other Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide details about the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
