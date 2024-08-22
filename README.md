# hl-sdk 🍧

An unofficial TypeScript SDK for interacting with the Hyperliquid API.


## Installation
[![npm version](https://badge.fury.io/js/hyperliquid-ts.svg)](https://badge.fury.io/js/hyperliquid-ts)
```bash
npm install hyperliquid-ts
```


## Usage
```typescript
import { HyperliquidAPI } from 'hyperliquid-ts';

const api = new HyperliquidAPI('YOUR_PRIVATE_KEY');

// Example: Get all mids
api.info.getAllMids().then(allMids => {
  console.log(allMids);
});
```
Note: Private key is optional but required for authenticated endpoints.


## APIs
The SDK is structured into several major components/classes covering the main HL APIs:

- info: General information endpoints
  - general: General market information
  - spot: Spot market information
  - perpetuals: Perpetuals market information
- exchange: Trading and account management endpoints
- subscriptions: WebSocket subscriptions
- custom: Custom utility methods and endpoints


## Info API
Access general market information:
```typescript
// Get all mids
api.info.getAllMids();

// Get L2 order book
api.info.getL2Book('BTC-PERP');

// Get user open orders
api.info.getUserOpenOrders('USER_ADDRESS');

// Get trade info
const oid = 123456
api.info.getTradeInfo('USER_ADDRESS', oid);
```


## Perpetuals Info API
Access information specific to perpetual markets:

```typescript
// Get perpetuals metadata
api.info.perpetuals.getMeta();

// Get perpetuals metadata and asset contexts
api.info.perpetuals.getMetaAndAssetCtxs();

// Get user's perpetuals clearinghouse state
api.info.perpetuals.getClearinghouseState('USER_ADDRESS');

// Get user funding information
api.info.perpetuals.getUserFunding('USER_ADDRESS', startTime, endTime);

// Get user non-funding ledger updates
api.info.perpetuals.getUserNonFundingLedgerUpdates('USER_ADDRESS', startTime, endTime);

// Get funding history for a specific coin
api.info.perpetuals.getFundingHistory('BTC-PERP', startTime, endTime);
```


## Spot Info
```typescript
// Get spot metadata
api.info.spot.getSpotMeta();

// Get spot clearinghouse state for a user
api.info.spot.getSpotClearinghouseState('USER_ADDRESS');

// Get spot metadata and asset contexts
api.info.spot.getSpotMetaAndAssetCtxs();
```


## Leaderboard API
Access and filter the trading leaderboard:

```typescript
// Get the current leaderboard
api.leaderboard.getLeaderboard();

// Get filtered and sorted leaderboard
api.leaderboard.getFilteredAndSortedLeaderboard({
  timeWindow: 'day',
  minAccountValue: 1000,
  minVolume: 10000,
  maxTrades: 100
}, 'pnl');

// Get extended trader information
api.leaderboard.getExtendedTraderInfo(traderEntry, 'week');

// Get a trader's best trade
api.leaderboard.getBestTrade('TRADER_ADDRESS', 'month');
```

### Advanced usage
The Leaderboard API also provide methods for more detailed analysis:
```typescript
// Get a trader's trade count
api.leaderboard.getTraderTradeCount('TRADER_ADDRESS', startTime, endTime);

// Get a trader's open positions
api.leaderboard.getTraderOpenPositions('TRADER_ADDRESS');
```

Note: The leaderboard data is cached for 24 hours to improve performance. You can manually clear the cache if needed:
```typescript
await api.leaderboard.clearCache();
```


## Symbol Conversion
The SDK now includes a SymbolConverter to handle any differences between exchange and internal symbol representations:

```typescript
// Convert from exchange to internal format
api.info.convertSymbol('BTC-0', 'internal');

// Convert from internal to exchange format
api.info.convertSymbol('BTC-PERP-0', 'reverse');

// Get all available assets
const assets = api.info.getAllAssets();
console.log(assets.perp); // List of perpetual assets
console.log(assets.spot); // List of spot assets
```
Please refer to [SYMBOLS.md](SYMBOLS.md) for more detailed info


## Exchange API
Manage orders and perform account actions:
```typescript
// Place an order
api.exchange.placeOrder({
  coin: 'BTC-PERP',
  is_buy: true,
  sz: 1,
  limit_px: 30000,
  order_type: { limit: { tif: 'Gtc' } },
  reduce_only: false
});

// Cancel an order
api.exchange.cancelOrder({
  coin: 'BTC-PERP',
  o: 123456 // order ID
});

// Transfer between spot and perpetual accounts
api.exchange.transferBetweenSpotAndPerp(100, true); // 100 USDC from spot to perp
```


## WebSocket Subscriptions
Subscribe to real-time data:
```typescript
// Subscribe to all mids
api.subscriptions.subscribeToAllMids(data => {
  console.log('All mids update:', data);
});

// Subscribe to trades for a specific symbol
api.subscriptions.subscribeToTrades('BTC-PERP', trades => {
  console.log('New trades:', trades);
});

// Unsubscribe from trades
api.subscriptions.unsubscribeFromTrades('BTC-PERP', callbackFunction);
```


## Custom Utilities
```typescript
// Cancel all orders
api.custom.cancelAllOrders();

// Cancel all orders for a specific symbol
api.custom.cancelAllOrders('BTC-PERP');

// Get all tradable assets
const assets = api.custom.getAllAssets();
```


## Error Handling
The SDK uses custom error types. Wrap API calls in try-catch blocks:
```typescript
try {
  const result = await api.exchange.placeOrder(/* ... */);
} catch (error) {
  if (error instanceof HyperliquidAPIError) {
    console.error('API Error:', error.message, 'Code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```


## Rate Limiting
The SDK implements rate limiting to comply with API restrictions. You don't need to manage this manually.


## WebSocket Connection
The WebSocket connection is managed automatically. Use `connect` and `disconnect` methods if you need manual control:
```typescript
await api.connect();
// ... perform operations
api.disconnect();
```


## Types
The SDK provides TypeScript types for all API responses and parameters. Import them as needed:
```typescript
import type { OrderRequest, UserOpenOrders } from 'hyperliquid-ts';
```


## Documentation
For detailed API documentation, refer to the official [Hyperliquid API docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api).


## Contributing
Contributions are welcome! Please submit pull requests or open issues on the GitHub repository.


## License
This project is licensed under the MIT License.
