
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBookProps {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  symbol: string;
  isConnected: boolean;
}

export const OrderBook = ({ bids, asks, symbol, isConnected }: OrderBookProps) => {
  const formatPrice = (price: number) => price.toFixed(2);
  const formatQuantity = (quantity: number) => quantity.toFixed(6);

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercentage = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order Book - {symbol.toUpperCase()}</span>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Live" : "Offline"}
          </Badge>
        </CardTitle>
        {bestBid > 0 && bestAsk > 0 && (
          <div className="text-sm text-muted-foreground">
            Spread: ${formatPrice(spread)} ({spreadPercentage.toFixed(4)}%)
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Asks (Sell Orders) */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">Asks</span>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                <div>Price</div>
                <div className="text-right">Quantity</div>
              </div>
              {asks.slice(0, 10).reverse().map((ask, index) => (
                <div key={`ask-${ask.price}-${index}`} className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-red-500 font-mono">${formatPrice(ask.price)}</div>
                  <div className="text-right font-mono">{formatQuantity(ask.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bids (Buy Orders) */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Bids</span>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                <div>Price</div>
                <div className="text-right">Quantity</div>
              </div>
              {bids.slice(0, 10).map((bid, index) => (
                <div key={`bid-${bid.price}-${index}`} className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-green-500 font-mono">${formatPrice(bid.price)}</div>
                  <div className="text-right font-mono">{formatQuantity(bid.quantity)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
