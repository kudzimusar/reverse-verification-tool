import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrustScoreComponents {
  ownershipContinuity: number;
  historyCompleteness: number;
  repairHistory: number;
  disputePenalty: number;
}

interface TrustScoreInfo {
  score: number;
  riskCategory: "low" | "medium" | "high";
  components: TrustScoreComponents;
  lastCalculated: Date;
}

interface TrustScoreDisplayProps {
  trustScore: TrustScoreInfo;
  previousScore?: number;
  scoreChange?: number;
}

export function TrustScoreDisplay({ trustScore, previousScore, scoreChange }: TrustScoreDisplayProps) {
  const getRiskColor = (category: string) => {
    switch (category) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChangeIcon = () => {
    if (!scoreChange) return <Minus className="h-4 w-4" />;
    if (scoreChange > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getChangeText = () => {
    if (!scoreChange) return 'No change';
    const sign = scoreChange > 0 ? '+' : '';
    return `${sign}${scoreChange} points`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>Trust Score</span>
        </CardTitle>
        <CardDescription>
          Dynamic trust assessment based on device history and verification data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Display */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className={`text-4xl font-bold ${getScoreColor(trustScore.score)}`}>
                {trustScore.score}
              </span>
              <div className="space-y-1">
                <Badge className={getRiskColor(trustScore.riskCategory)}>
                  {trustScore.riskCategory.toUpperCase()} RISK
                </Badge>
                {scoreChange !== undefined && (
                  <div className="flex items-center space-x-1 text-sm">
                    {getChangeIcon()}
                    <span>{getChangeText()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="w-64">
              <Progress 
                value={trustScore.score} 
                className="h-3"
                style={{
                  '--progress-background': getProgressColor(trustScore.score),
                } as React.CSSProperties}
              />
            </div>
          </div>
        </div>

        {/* Score Components Breakdown */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-gray-700">Score Components</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ownership Continuity</span>
                <span className="text-sm font-medium">{trustScore.components.ownershipContinuity}/30</span>
              </div>
              <Progress value={(trustScore.components.ownershipContinuity / 30) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">History Completeness</span>
                <span className="text-sm font-medium">{trustScore.components.historyCompleteness}/25</span>
              </div>
              <Progress value={(trustScore.components.historyCompleteness / 25) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Repair History</span>
                <span className="text-sm font-medium">{trustScore.components.repairHistory}/20</span>
              </div>
              <Progress value={(trustScore.components.repairHistory / 20) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dispute Penalty</span>
                <span className={`text-sm font-medium ${trustScore.components.disputePenalty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {trustScore.components.disputePenalty}
                </span>
              </div>
              {trustScore.components.disputePenalty < 0 && (
                <div className="text-xs text-red-600">
                  Penalties applied for reports and disputes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="p-4 rounded-lg bg-gray-50">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Risk Assessment</h4>
          <div className="text-sm text-gray-600">
            {trustScore.riskCategory === 'low' && (
              <p>This device has a strong verification history with minimal risk indicators. Safe for transaction.</p>
            )}
            {trustScore.riskCategory === 'medium' && (
              <p>This device has some verification gaps or minor concerns. Exercise normal caution during transaction.</p>
            )}
            {trustScore.riskCategory === 'high' && (
              <p>This device has significant risk indicators or verification issues. Proceed with extreme caution or avoid transaction.</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Last calculated: {formatDate(trustScore.lastCalculated)}
        </div>
      </CardContent>
    </Card>
  );
}
