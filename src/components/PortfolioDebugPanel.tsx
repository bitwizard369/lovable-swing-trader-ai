
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Calculator, RefreshCw, AlertCircle, Shield, DollarSign } from "lucide-react";
import { Portfolio } from "@/types/trading";
import { ReconciliationReport, PortfolioReconciliationService } from "@/utils/portfolioReconciliation";

interface PortfolioDebugPanelProps {
  portfolio: Portfolio;
  reconciliationReport: ReconciliationReport | null;
  onReconcile: () => void;
}

export const PortfolioDebugPanel = ({ 
  portfolio, 
  reconciliationReport, 
  onReconcile 
}: PortfolioDebugPanelProps) => {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 6,
      maximumFractionDigits: 6 
    }).format(amount);

  const formatDifference = (diff: number) => {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(6)}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  // Get risk assessment if we have a report
  const riskAssessment = reconciliationReport 
    ? PortfolioReconciliationService.assessProductionRisk(reconciliationReport)
    : null;

  if (!reconciliationReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Production Portfolio Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">Live Trading Mode Active</p>
              <Badge variant="destructive" className="mb-3">PRODUCTION</Badge>
            </div>
            <Button onClick={onReconcile} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Run Production Validation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cardBorderClass = reconciliationReport.hasCriticalDiscrepancies 
    ? 'border-red-500 border-2' 
    : !reconciliationReport.isConsistent 
    ? 'border-yellow-400' 
    : 'border-green-400';

  return (
    <Card className={cardBorderClass}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {reconciliationReport.hasCriticalDiscrepancies ? (
              <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
            ) : reconciliationReport.isConsistent ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                Production Portfolio Validation
                <Badge variant="destructive" className="text-xs">LIVE</Badge>
              </div>
              {riskAssessment && (
                <div className="text-xs text-muted-foreground mt-1">
                  Risk Level: <span className={`font-bold ${
                    riskAssessment.riskLevel === 'CRITICAL' ? 'text-red-600' :
                    riskAssessment.riskLevel === 'HIGH' ? 'text-orange-600' :
                    riskAssessment.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                  }`}>{riskAssessment.riskLevel}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={reconciliationReport.isConsistent ? 'default' : 
                           reconciliationReport.hasCriticalDiscrepancies ? 'destructive' : 'secondary'}>
              {reconciliationReport.hasCriticalDiscrepancies ? 
                `CRITICAL - ${reconciliationReport.discrepancies.filter(d => d.severity === 'critical').length} Issues` :
                reconciliationReport.isConsistent ? 'VALIDATED' : 
                `${reconciliationReport.discrepancies.length} Issues`}
            </Badge>
            <Button size="sm" onClick={onReconcile} className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Revalidate
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Critical Alert */}
        {riskAssessment?.shouldHaltTrading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-semibold">
              <AlertCircle className="h-4 w-4" />
              TRADING HALT RECOMMENDED
            </div>
            <div className="text-sm text-red-700">
              <p className="mb-2">Critical discrepancies detected. Recommended actions:</p>
              <ul className="list-disc list-inside space-y-1">
                {riskAssessment.recommendedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Financial Impact Summary */}
        {reconciliationReport.discrepancies.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-yellow-800">Financial Impact Analysis</span>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total Potential Impact:</span>
                <span className="font-mono ml-2 text-red-600">
                  {formatCurrency(reconciliationReport.discrepancies.reduce((sum, d) => sum + d.potentialImpact, 0))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Risk Flags:</span>
                <div className="ml-2">
                  {Object.entries(reconciliationReport.riskFlags).map(([flag, active]) => 
                    active && <Badge key={flag} variant="outline" className="text-xs mr-1">{flag}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Status */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Validation Status</p>
            <p className={`font-medium ${
              reconciliationReport.hasCriticalDiscrepancies ? 'text-red-600' :
              reconciliationReport.isConsistent ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {reconciliationReport.hasCriticalDiscrepancies ? 'CRITICAL ERRORS' :
               reconciliationReport.isConsistent ? 'All Valid' : 'Issues Found'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Validation</p>
            <p className="font-medium">
              {new Date(reconciliationReport.metadata.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Validation ID</p>
            <p className="font-mono text-xs">{reconciliationReport.metadata.reconciliationId.slice(-8)}</p>
          </div>
        </div>

        {/* Expected vs Actual Values - Production Precision */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Production Calculations (6 decimal precision)</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Equity:</span>
                <span className="font-mono">{formatCurrency(reconciliationReport.calculatedValues.expectedEquity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Equity:</span>
                <span className="font-mono">{formatCurrency(portfolio.equity)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Difference:</span>
                <span className={`font-mono ${Math.abs(portfolio.equity - reconciliationReport.calculatedValues.expectedEquity) > 0.001 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                  {formatDifference(portfolio.equity - reconciliationReport.calculatedValues.expectedEquity)}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Available:</span>
                <span className="font-mono">{formatCurrency(reconciliationReport.calculatedValues.expectedAvailableBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Available:</span>
                <span className="font-mono">{formatCurrency(portfolio.availableBalance)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Difference:</span>
                <span className={`font-mono ${Math.abs(portfolio.availableBalance - reconciliationReport.calculatedValues.expectedAvailableBalance) > 0.001 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                  {formatDifference(portfolio.availableBalance - reconciliationReport.calculatedValues.expectedAvailableBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Discrepancies with Enhanced Display */}
        {reconciliationReport.discrepancies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-red-700">Production Issues Detected</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reconciliationReport.discrepancies
                .sort((a, b) => {
                  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                  return severityOrder[b.severity] - severityOrder[a.severity];
                })
                .map((discrepancy, index) => (
                <div key={index} className={`flex items-start justify-between p-3 border rounded text-xs ${
                  discrepancy.severity === 'critical' ? 'bg-red-50 border-red-200' : 
                  discrepancy.severity === 'high' ? 'bg-orange-50 border-orange-200' : 
                  'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{getSeverityIcon(discrepancy.severity)}</span>
                      <Badge variant={getSeverityColor(discrepancy.severity)} className="text-xs">
                        {discrepancy.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{discrepancy.field}</span>
                    </div>
                    <p className="text-muted-foreground mb-1">{discrepancy.description}</p>
                    <p className="text-xs text-red-600 font-medium">
                      Financial Impact: {formatCurrency(discrepancy.potentialImpact)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-mono text-red-600 font-bold">
                      Δ {formatDifference(discrepancy.difference)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production Portfolio Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Portfolio Status</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="text-center">
              <p className="text-muted-foreground">Open Positions</p>
              <p className="font-bold text-lg">{reconciliationReport.metadata.openPositionsCount}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Total Exposure</p>
              <p className="font-bold text-lg">{formatCurrency(reconciliationReport.metadata.totalExposure)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Locked Profits</p>
              <p className="font-bold text-lg">{formatCurrency(portfolio.lockedProfits)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
