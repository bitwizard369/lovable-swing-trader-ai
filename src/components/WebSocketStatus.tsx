
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Activity, AlertCircle, CheckCircle } from "lucide-react";

interface WebSocketStatusProps {
  isConnected: boolean;
  apiHealthy: boolean | null;
  latestUpdate: any;
  onConnect: () => void;
  onDisconnect: () => void;
  onCheckHealth: () => void;
}

export const WebSocketStatus = ({
  isConnected,
  apiHealthy,
  latestUpdate,
  onConnect,
  onDisconnect,
  onCheckHealth
}: WebSocketStatusProps) => {
  // Enhanced connection validation
  const isReallyConnected = isConnected && latestUpdate && 
    (Date.now() - latestUpdate.E < 30000); // Consider disconnected if no updates for 30s
  
  const connectionStatus = isReallyConnected ? 'LIVE' : 
    (isConnected ? 'STALE' : 'DISCONNECTED');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Binance.US WebSocket Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isReallyConnected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : isConnected ? (
              <Wifi className="h-4 w-4 text-yellow-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Connection Status:</span>
          </div>
          <Badge variant={
            isReallyConnected ? "default" : 
            isConnected ? "secondary" : "destructive"
          }>
            {connectionStatus}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">API Health:</span>
          </div>
          <Badge variant={
            apiHealthy === null ? "secondary" : 
            apiHealthy ? "default" : "destructive"
          }>
            {apiHealthy === null ? "Checking..." : 
             apiHealthy ? "Healthy" : "Unhealthy"}
          </Badge>
        </div>

        {latestUpdate && (
          <div className="text-xs text-muted-foreground">
            <div>Last Update: {new Date(latestUpdate.E).toLocaleTimeString()}</div>
            <div>Symbol: {latestUpdate.s}</div>
            <div>Update ID: {latestUpdate.u}</div>
            <div className={`${isReallyConnected ? 'text-green-600' : 'text-yellow-600'}`}>
              Data Age: {Math.round((Date.now() - latestUpdate.E) / 1000)}s
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={isConnected ? onDisconnect : onConnect}
            variant={isConnected ? "destructive" : "default"}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCheckHealth}>
            Check Health
          </Button>
        </div>

        {!isReallyConnected && isConnected && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ Connection appears stale - no recent data updates
          </div>
        )}
      </CardContent>
    </Card>
  );
};
