
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, ShieldAlert, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Position } from "@/types/trading";
import { useEffect, useState } from "react";

interface SimplifiedPositionsProps {
  positions: Position[];
}

export const SimplifiedPositions = ({ positions }: SimplifiedPositionsProps) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time every second for accurate time remaining display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateDynamicLevels = (position: Position) => {
    // Enhanced dynamic TP/SL calculation (300 second hold time)
    const maxHoldTime = 300; // 5 minutes
    const elapsedTime = Math.floor((currentTime - position.timestamp) / 1000);
    const timeRemaining = Math.max(0, maxHoldTime - elapsedTime);
    
    // Dynamic profit targets based on market conditions and time
    const baseTPPercentage = 0.015; // 1.5%
    const baseSLPercentage = 0.008; // 0.8%
    
    // Adjust targets based on time decay (more aggressive as time runs out)
    const timeDecayFactor = 1 - (elapsedTime / maxHoldTime);
    const adjustedTP = baseTPPercentage * (0.7 + timeDecayFactor * 0.6);
    const adjustedSL = baseSLPercentage * (1.2 - timeDecayFactor * 0.4);
    
    if (position.side === 'BUY') {
      return {
        dynamicTakeProfit: position.entryPrice * (1 + adjustedTP),
        dynamicStopLoss: position.entryPrice * (1 - adjustedSL),
        timeRemaining,
        maxHoldTime
      };
    } else {
      return {
        dynamicTakeProfit: position.entryPrice * (1 - adjustedTP),
        dynamicStopLoss: position.entryPrice * (1 + adjustedSL),
        timeRemaining,
        maxHoldTime
      };
    }
  };

  const getExitReasonDisplay = (reason?: string) => {
    const exitReasons = {
      'TAKE_PROFIT': { label: 'Take Profit Hit', color: 'text-green-600', icon: CheckCircle },
      'STOP_LOSS': { label: 'Stop Loss Hit', color: 'text-red-600', icon: AlertTriangle },
      'DYNAMIC_EXIT': { label: 'Dynamic Exit', color: 'text-blue-600', icon: TrendingUp },
      'TIME_LIMIT': { label: 'Time Limit', color: 'text-orange-600', icon: Clock },
      'MANUAL': { label: 'Manual Close', color: 'text-gray-600', icon: Target },
      'RISK_MANAGEMENT': { label: 'Risk Management', color: 'text-red-600', icon: ShieldAlert }
    };
    
    return exitReasons[reason as keyof typeof exitReasons] || null;
  };

  const openPositions = positions.filter(p => p.status === 'OPEN');
  const closedPositions = positions.filter(p => p.status === 'CLOSED').slice(-3); // Show last 3 closed

  return (
    <div className="space-y-4">
      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Open Positions</span>
            <Badge variant="outline">{openPositions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No open positions</p>
          ) : (
            <div className="space-y-4">
              {openPositions.map((position) => {
                const { dynamicTakeProfit, dynamicStopLoss, timeRemaining, maxHoldTime } = calculateDynamicLevels(position);
                const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
                const isProfit = position.unrealizedPnL >= 0;
                const timePercentage = (timeRemaining / maxHoldTime) * 100;

                return (
                  <div key={position.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{position.symbol.toUpperCase()}</span>
                        <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'}>
                          {position.side}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </div>
                        <div className={`text-sm ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                          {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Time Remaining Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>Time Remaining</span>
                        </div>
                        <span className={timeRemaining < 60 ? 'text-red-500 font-bold' : 'font-medium'}>
                          {formatTime(timeRemaining)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            timePercentage > 50 ? 'bg-green-500' : 
                            timePercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${timePercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Position Details Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Size</p>
                        <p className="font-semibold">{position.size.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entry</p>
                        <p className="font-semibold">{formatCurrency(position.entryPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="font-semibold">{formatCurrency(position.currentPrice)}</p>
                      </div>
                    </div>

                    {/* Dynamic TP/SL Levels */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Dynamic Take Profit</p>
                          <p className="font-semibold text-green-600">{formatCurrency(dynamicTakeProfit)}</p>
                          <p className="text-xs text-green-600">
                            Adjusts with time decay
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Dynamic Stop Loss</p>
                          <p className="font-semibold text-red-600">{formatCurrency(dynamicStopLoss)}</p>
                          <p className="text-xs text-red-600">
                            Tightens over time
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Closed Positions with Exit Reasons */}
      {closedPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Closed Positions</span>
              <Badge variant="outline">{closedPositions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {closedPositions.map((position) => {
                const exitReasonDisplay = getExitReasonDisplay(position.exitReason);
                const ExitIcon = exitReasonDisplay?.icon || Target;
                
                return (
                  <div key={position.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{position.symbol.toUpperCase()}</span>
                        <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'}>
                          {position.side}
                        </Badge>
                        {exitReasonDisplay && (
                          <div className="flex items-center gap-1">
                            <ExitIcon className={`h-3 w-3 ${exitReasonDisplay.color}`} />
                            <span className={`text-xs ${exitReasonDisplay.color}`}>
                              {exitReasonDisplay.label}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`font-medium ${position.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(position.realizedPnL)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
