
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Calculator, RefreshCw } from "lucide-react";
import { Portfolio } from "@/types/trading";
import { ReconciliationReport } from "@/utils/portfolioReconciliation";

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
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDifference = (diff: number) => {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (!reconciliationReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Portfolio Debug
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Button onClick={onReconcile} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Run Portfolio Reconciliation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${!reconciliationReport.isConsistent ? 'border-yellow-300' : 'border-green-300'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {reconciliationReport.isConsistent ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Portfolio Debug
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={reconciliationReport.isConsistent ? 'default' : 'secondary'}>
              {reconciliationReport.isConsistent ? 'Consistent' : `${reconciliationReport.discrepancies.length} Issues`}
            </Badge>
            <Button size="sm" onClick={onReconcile} className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Recheck
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Reconciliation Status */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Reconciliation Status</p>
            <p className={`font-medium ${reconciliationReport.isConsistent ? 'text-green-600' : 'text-yellow-600'}`}>
              {reconciliationReport.isConsistent ? 'All calculations valid' : 'Discrepancies found'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Check</p>
            <p className="font-medium">
              {new Date(reconciliationReport.metadata.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Expected vs Actual Values */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Calculated Values</h4>
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
                <span className={`font-mono ${Math.abs(portfolio.equity - reconciliationReport.calculatedValues.expectedEquity) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDifference(portfolio.equity - reconciliationReport.calculatedValues.expectedEquity)}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Total P&L:</span>
                <span className="font-mono">{formatCurrency(reconciliationReport.calculatedValues.expectedTotalPnL)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Total P&L:</span>
                <span className="font-mono">{formatCurrency(portfolio.totalPnL)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Difference:</span>
                <span className={`font-mono ${Math.abs(portfolio.totalPnL - reconciliationReport.calculatedValues.expectedTotalPnL) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDifference(portfolio.totalPnL - reconciliationReport.calculatedValues.expectedTotalPnL)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Discrepancies */}
        {reconciliationReport.discrepancies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-yellow-700">Found Issues</h4>
            <div className="space-y-2">
              {reconciliationReport.discrepancies.map((discrepancy, index) => (
                <div key={index} className="flex items-start justify-between p-2 border rounded text-xs">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(discrepancy.severity)} className="text-xs">
                        {discrepancy.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{discrepancy.field}</span>
                    </div>
                    <p className="text-muted-foreground">{discrepancy.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-red-600">
                      Δ {formatDifference(discrepancy.difference)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Portfolio Breakdown</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="text-center">
              <p className="text-muted-foreground">Open Positions</p>
              <p className="font-bold text-lg">{reconciliationReport.metadata.openPositionsCount}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Closed Positions</p>
              <p className="font-bold text-lg">{reconciliationReport.metadata.closedPositionsCount}</p>
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
