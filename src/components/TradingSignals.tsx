
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TradingSignal } from "@/types/trading";
import { Brain, TrendingUp, TrendingDown, Clock } from "lucide-react";

interface TradingSignalsProps {
  signals: TradingSignal[];
  latestSignal: TradingSignal | null;
  onExecuteSignal?: (signal: TradingSignal) => void;
}

export const TradingSignals = ({ signals, latestSignal, onExecuteSignal }: TradingSignalsProps) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-500';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Latest Signal */}
      {latestSignal && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Latest Trading Signal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge variant={latestSignal.action === 'BUY' ? 'default' : 'destructive'} className="text-lg px-3 py-1">
                  {latestSignal.action}
                </Badge>
                <span className="text-lg font-semibold">{latestSignal.symbol.toUpperCase()}</span>
                <span className={`font-medium ${getConfidenceColor(latestSignal.confidence)}`}>
                  {Math.round(latestSignal.confidence * 100)}% confidence
                </span>
              </div>
              {onExecuteSignal && (
                <Button 
                  onClick={() => onExecuteSignal(latestSignal)}
                  variant={latestSignal.action === 'BUY' ? 'default' : 'destructive'}
                >
                  Execute Signal
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="font-mono">{formatPrice(latestSignal.price)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="font-mono">{latestSignal.quantity.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-mono">{formatTime(latestSignal.timestamp)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Reasoning</p>
              <p className="text-sm">{latestSignal.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Signal History
            </span>
            <Badge variant="outline">{signals.length} signals</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No signals generated yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {signals.slice().reverse().map((signal, index) => (
                <div key={`${signal.timestamp}-${index}`} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {signal.action === 'BUY' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={signal.action === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {signal.action}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium">{signal.symbol.toUpperCase()}</span>
                    <span className="text-sm font-mono">{formatPrice(signal.price)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${getConfidenceColor(signal.confidence)}`}>
                      {Math.round(signal.confidence * 100)}%
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTime(signal.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
