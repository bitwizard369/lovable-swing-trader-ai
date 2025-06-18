
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Shield, TrendingUp } from "lucide-react";

interface AutoTradingStatus {
  enabled: boolean;
  emergencyStopped: boolean;
  dailyPnL: number;
  executedToday: number;
  dryRunMode: boolean;
}

interface AutoTradingControlsProps {
  status: AutoTradingStatus | null;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleDryRun: (dryRun: boolean) => void;
  onResetEmergencyStop: () => void;
  onOpenSettings: () => void;
}

export const AutoTradingControls = ({
  status,
  onToggleEnabled,
  onToggleDryRun,
  onResetEmergencyStop,
  onOpenSettings
}: AutoTradingControlsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Auto Trading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Auto trading engine not initialized</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${status.enabled ? 'border-green-200' : 'border-gray-200'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Auto Trading
          </span>
          <div className="flex items-center gap-2">
            {status.dryRunMode && (
              <Badge variant="secondary">DRY RUN</Badge>
            )}
            {status.emergencyStopped && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                STOPPED
              </Badge>
            )}
            <Badge variant={status.enabled ? 'default' : 'outline'}>
              {status.enabled ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Daily P&L</p>
            <p className={`text-lg font-bold ${status.dailyPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(status.dailyPnL)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Trades Today</p>
            <p className="text-lg font-bold">{status.executedToday}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-trading-enabled" className="text-sm">
              Enable Auto Trading
            </Label>
            <Switch
              id="auto-trading-enabled"
              checked={status.enabled}
              onCheckedChange={onToggleEnabled}
              disabled={status.emergencyStopped}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dry-run-mode" className="text-sm">
              Dry Run Mode
            </Label>
            <Switch
              id="dry-run-mode"
              checked={status.dryRunMode}
              onCheckedChange={onToggleDryRun}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t">
          {status.emergencyStopped && (
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={onResetEmergencyStop}
              className="flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              Reset Stop
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onOpenSettings}
            className="flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Button>
        </div>

        {/* Warning Messages */}
        {status.emergencyStopped && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            ⚠️ Emergency stop triggered due to daily loss limit. Review and reset to continue.
          </div>
        )}

        {status.dryRunMode && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            📝 Dry run mode active - signals will be logged but not executed.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
