export const BASE_URLS = {
    MAINNET: 'https://api.hyperliquid.xyz',
    TESTNET: 'https://api.hyperliquid-testnet.xyz',
} as const;

export const WSS_URLS = {
    MAINNET: 'wss://api.hyperliquid.xyz/ws',
    TESTNET: 'wss://api.hyperliquid-testnet.xyz/ws',
} as const;

export const ENDPOINTS = {
    INFO: '/info',
    EXCHANGE: '/exchange',
} as const;

export const INFO_TYPES = {
    ALL_MIDS: 'allMids',
    META: 'meta',
    OPEN_ORDERS: 'openOrders',
    FRONTEND_OPEN_ORDERS: 'frontendOpenOrders',
    USER_FILLS: 'userFills',
    USER_FILLS_BY_TIME: 'userFillsByTime',
    USER_RATE_LIMIT: 'userRateLimit',
    SPOT_USER_FILLS_BY_TIME: 'spotUserFillsByTime' as const,
    TRADE_INFO: 'tradeInfo' as const,
    ORDER_STATUS: 'orderStatus',
    L2_BOOK: 'l2Book',
    CANDLE_SNAPSHOT: 'candleSnapshot',
    PERPS_META_AND_ASSET_CTXS: 'metaAndAssetCtxs',
    PERPS_CLEARINGHOUSE_STATE: 'clearinghouseState',
    USER_FUNDING: 'userFunding',
    USER_NON_FUNDING_LEDGER_UPDATES: 'userNonFundingLedgerUpdates',
    FUNDING_HISTORY: 'fundingHistory',
    SPOT_META: 'spotMeta',
    SPOT_CLEARINGHOUSE_STATE: 'spotClearinghouseState',
    SPOT_META_AND_ASSET_CTXS: 'spotMetaAndAssetCtxs',
    LEADERBOARD: 'leaderboard',
} as const;

export const EXCHANGE_TYPES = {
    ORDER: 'order',
    CANCEL: 'cancel',
    CANCEL_BY_CLOID: 'cancelByCloid',
    SCHEDULE_CANCEL: 'scheduleCancel',
    MODIFY: 'modify',
    BATCH_MODIFY: 'batchModify',
    UPDATE_LEVERAGE: 'updateLeverage',
    UPDATE_ISOLATED_MARGIN: 'updateIsolatedMargin',
    USD_SEND: 'usdSend',
    SPOT_SEND: 'spotSend',
    WITHDRAW: 'withdraw3',
    SPOT_USER: 'spotUser',
    VAULT_TRANSFER: 'vaultTransfer',
    SET_REFERRER: 'setReferrer',
} as const;

export const WEBSOCKET = {
    MAINNET_URL: WSS_URLS.MAINNET,
    TESTNET_URL: WSS_URLS.TESTNET,
} as const;
