import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: "clean" | "flagged" | "under_investigation";
  size?: "sm" | "lg";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = {
    clean: {
      label: "Clean",
      variant: "default" as const,
      icon: CheckCircle,
      className: "bg-green-100 text-green-800 border-green-200",
    },
    flagged: {
      label: "Flagged",
      variant: "destructive" as const,
      icon: XCircle,
      className: "bg-red-100 text-red-800 border-red-200",
    },
    under_investigation: {
      label: "Under Investigation",
      variant: "secondary" as const,
      icon: AlertTriangle,
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
  };

  const { label, icon: Icon, className } = config[status];
  const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <Badge className={`${className} flex items-center space-x-1 ${size === "lg" ? "px-3 py-1.5 text-sm" : ""}`}>
      <Icon className={iconSize} />
      <span>{label}</span>
    </Badge>
  );
}
