## Symbol Naming Convention and Duplicate Handling

The SDK uses a consistent naming convention for symbols and implements a robust system for handling duplicates.

### Naming Convention

1. **Perpetuals**: `<coin>-PERP-<index>` (e.g., BTC-PERP-0, ETH-PERP-1)
2. **Spot**: `<coin>-SPOT-<index>` (e.g., BTC-SPOT-0, ETH-SPOT-1)

The `<index>` is a unique identifier assigned to each asset, ensuring that even assets with the same name can be distinguished.

### Exchange to Internal Name Mapping

The SDK maintains a bidirectional mapping between exchange symbols and internal names:

- Exchange Symbol: `<coin>-<index>` (e.g., BTC-0, ETH-1)
- Internal Name: `<coin>-PERP-<index>` or `<coin>-SPOT-<index>`

### Handling Duplicates

In cases where multiple assets might share the same name (e.g., different versions of a token), the SDK ensures unique identification:

1. Each asset is assigned a unique index.
2. The index is incorporated into both the exchange symbol and the internal name.
3. This approach allows the SDK to differentiate between assets that might otherwise have identical names.

Example:
- USDC-0 (Exchange) ↔ USDC-SPOT-0 (Internal)
- USDC-1 (Exchange) ↔ USDC-SPOT-1 (Internal)

### Symbol Conversion

The `SymbolConverter` class handles conversions between exchange symbols and internal names:

```typescript
const converter = new SymbolConverter();

// Exchange to internal
console.log(converter.convertSymbol('BTC-0')); // Output: BTC-PERP-0

// Internal to exchange
console.log(converter.convertSymbol('BTC-PERP-0', 'reverse')); // Output: BTC-0
```

### Accessing Asset Information

You can retrieve asset information using these methods:

```typescript
const api = new HyperliquidAPI();

// Get all assets
const allAssets = api.getAllAssets();
console.log(allAssets.perp); // List of all perpetual assets
console.log(allAssets.spot); // List of all spot assets

// Get asset index
const btcIndex = api.getAssetIndex('BTC-PERP-0');

// Get internal name from exchange symbol
const internalName = api.getInternalName('BTC-0');
```

This naming system and duplicate handling ensure that each asset can be uniquely identified and correctly processed throughout the SDK, even in complex scenarios involving multiple assets with similar names.