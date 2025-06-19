
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Activity, Clock } from "lucide-react";

interface StatusBarProps {
  isConnected: boolean;
  apiHealthy: boolean;
  latestUpdate: any;
  symbol: string;
  currentPrice?: number;
}

export const StatusBar = ({ 
  isConnected, 
  apiHealthy, 
  latestUpdate, 
  symbol,
  currentPrice 
}: StatusBarProps) => {
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

  return (
    <div className="flex items-center justify-between py-2 px-4 bg-muted/30 border-b">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <Badge variant={apiHealthy ? "default" : "destructive"} className="text-xs">
            API {apiHealthy ? "Healthy" : "Error"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{symbol.toUpperCase()}</span>
          {currentPrice && (
            <span className="font-mono">{formatPrice(currentPrice)}</span>
          )}
        </div>
      </div>

      {latestUpdate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Last update: {formatTime(latestUpdate.E)}</span>
        </div>
      )}
    </div>
  );
};
