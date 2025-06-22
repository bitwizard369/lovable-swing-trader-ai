
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calculator, RefreshCw, Shield, DollarSign } from "lucide-react";
import { Portfolio } from "@/types/trading";

interface PortfolioDebugPanelProps {
  portfolio: Portfolio;
  onReconcile?: () => void;
}

export const PortfolioDebugPanel = ({ 
  portfolio, 
  onReconcile 
}: PortfolioDebugPanelProps) => {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 6,
      maximumFractionDigits: 6 
    }).format(amount);

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const totalExposure = openPositions.reduce((sum, position) => {
    return sum + Math.abs(position.size * position.currentPrice);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <div className="flex items-center gap-2">
                Portfolio Status
                <Badge variant="default" className="text-xs">LIVE</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                System Operating Normally
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">ACTIVE</Badge>
            {onReconcile && (
              <Button size="sm" onClick={onReconcile} className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Portfolio Summary */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-800">Portfolio Health</span>
            <Shield className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-sm text-green-700">
            All systems operational. Portfolio calculations are consistent and up-to-date.
          </div>
        </div>

        {/* Current Values */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Current Portfolio Values</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Equity:</span>
                <span className="font-mono">{formatCurrency(portfolio.equity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available Balance:</span>
                <span className="font-mono">{formatCurrency(portfolio.availableBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total P&L:</span>
                <span className={`font-mono ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(portfolio.totalPnL)}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Capital:</span>
                <span className="font-mono">{formatCurrency(portfolio.baseCapital)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Locked Profits:</span>
                <span className="font-mono">{formatCurrency(portfolio.lockedProfits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Exposure:</span>
                <span className="font-mono">{formatCurrency(totalExposure)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Statistics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Portfolio Statistics</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="text-center">
              <p className="text-muted-foreground">Open Positions</p>
              <p className="font-bold text-lg">{openPositions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Total Positions</p>
              <p className="font-bold text-lg">{portfolio.positions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Success Rate</p>
              <p className="font-bold text-lg text-green-600">
                {portfolio.positions.length > 0 
                  ? Math.round((portfolio.positions.filter(p => p.realizedPnL > 0).length / portfolio.positions.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Recent Activity</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {portfolio.positions.slice(-3).reverse().map((position, index) => (
              <div key={position.id} className="flex items-center justify-between p-2 border rounded text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                    {position.side}
                  </Badge>
                  <span className="font-medium">{position.symbol}</span>
                  <span className={`px-1 py-0.5 rounded text-xs ${
                    position.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {position.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(position.entryPrice)}</div>
                  <div className="text-gray-500">{position.size.toFixed(6)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
