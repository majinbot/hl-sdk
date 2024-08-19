import { Wallet } from 'ethers';
import { InfoAPI } from './rest/info';
import { ExchangeAPI } from './rest/exchange';
import { WebSocketClient } from './websocket/connection';
import { WebSocketSubscriptions } from './websocket/subscriptions';
import { RateLimiter } from './utils/rateLimiter';
import { HttpApi } from './utils/helpers';
import { BASE_URLS, ENDPOINTS, INFO_TYPES } from './constants';
import { CustomOperations } from './rest/custom';
import { IS_MAINNET } from './config';
import { LeaderboardAPI } from './rest/info/leaderboard';

/**
 * Custom error class for authentication-related errors.
 */
class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * Main class for interacting with the Hyperliquid API.
 * Provides access to various API functionalities including info, exchange operations, WebSocket, and custom operations.
 */
export class HyperliquidAPI {
    /**
     * API for retrieving general information from Hyperliquid.
     */
    public readonly info: InfoAPI;

    /**
     * API for performing exchange operations. Requires authentication.
     */
    public exchange: ExchangeAPI;

    /**
     * WebSocket client for real-time data.
     */
    public readonly ws: WebSocketClient;

    /**
     * WebSocket subscriptions manager.
     */
    public readonly subscriptions: WebSocketSubscriptions;

    /**
     * Custom operations API. Requires authentication.
     */
    public custom: CustomOperations;

    /**
     * API for accessing leaderboard information.
     */
    public readonly leaderboard: LeaderboardAPI;

    /**
     * Rate limiter to manage API request frequency.
     */
    private readonly rateLimiter: RateLimiter;

    /**
     * Maps internal asset names to their corresponding index in the Hyperliquid system.
     * Key: Internal asset name (e.g., "BTC-PERP" or "ETH-SPOT")
     * Value: Asset index used by the Hyperliquid API
     */
    private readonly assetToIndexMap: Map<string, number> = new Map();

    /**
     * Timer for periodic refresh of asset mappings.
     * Null when not active.
     */
    private refreshInterval: Timer | null = null;

    /**
     * Interval in milliseconds for refreshing asset mappings.
     * Default is set to 60000ms (1 minute).
     */
    private readonly refreshIntervalMs: number = 60_000;

    /**
     * Promise that resolves when the API is fully initialized.
     * Used to ensure that asset mappings are loaded before certain operations.
     */
    private readonly initializationPromise: Promise<void>;

    /**
     * Maps exchange asset names to internal asset names.
     * Key: Exchange asset name (e.g., "BTC" for perpetual or spot)
     * Value: Internal asset name (e.g., "BTC-PERP" or "BTC-SPOT")
     */
    private readonly exchangeToInternalNameMap: Map<string, string> = new Map();

    /**
     * HTTP API client for placing direct requests to the Hyperliquid API.
     */
    private readonly httpApi: HttpApi;

    /**
     * Indicates whether a valid private key has been provided for authentication.
     * True if a valid key is set, false otherwise.
     */
    private isValidPrivateKey: boolean = false;

    /**
     * Creates a new instance of the HyperliquidAPI.
     * @param privateKey - Optional private key for authentication. If provided, enables authenticated API calls.
     * @param isMainnet - Boolean indicating whether to use mainnet (true) or testnet (false). Defaults to the value in IS_MAINNET.
     */
    constructor(privateKey: string | null = null, isMainnet: boolean = IS_MAINNET) {
        const baseURL = isMainnet ? BASE_URLS.PRODUCTION : BASE_URLS.TESTNET;

        this.rateLimiter = new RateLimiter();
        this.httpApi = new HttpApi(baseURL, ENDPOINTS.INFO, this.rateLimiter);

        this.initializationPromise = this.initialize();

        this.info = new InfoAPI(
            baseURL,
            this.rateLimiter,
            this.assetToIndexMap,
            this.exchangeToInternalNameMap,
            this.initializationPromise
        );
        this.ws = new WebSocketClient(!isMainnet);
        this.subscriptions = new WebSocketSubscriptions(
            this.ws,
            this.exchangeToInternalNameMap,
            this.initializationPromise
        );

        this.exchange = this.createAuthenticatedProxy(ExchangeAPI);
        this.custom = this.createAuthenticatedProxy(CustomOperations);
        this.leaderboard = new LeaderboardAPI(this.httpApi, this.info.generalAPI, this.info.perpetuals, this.info.spot);

        if (privateKey) {
            this.initializeWithPrivateKey(privateKey, baseURL);
        }
    }

    /**
     * Creates a proxy for authenticated API calls.
     * @param Class - The class to be proxied.
     * @returns A proxied instance of the class that checks for authentication before allowing method calls.
     */
    private createAuthenticatedProxy<T extends object>(Class: new (...args: any[]) => T): T {
        return new Proxy({} as T, {
            get: (target, prop) => {
                if (!this.isValidPrivateKey) {
                    throw new AuthenticationError(
                        'Invalid or missing private key. This method requires authentication.'
                    );
                }
                return target[prop as keyof T];
            },
        });
    }

    /**
     * Initializes the API with a private key for authenticated calls.
     * @param privateKey - The private key to use for authentication.
     * @param baseURL - The base URL for API calls.
     */
    private initializeWithPrivateKey(privateKey: string, baseURL: string): void {
        try {
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            new Wallet(formattedPrivateKey); // Validate the private key

            this.exchange = new ExchangeAPI(
                baseURL,
                formattedPrivateKey,
                this.rateLimiter,
                this.assetToIndexMap,
                this.exchangeToInternalNameMap,
                this.initializationPromise
            );
            this.custom = new CustomOperations(
                this.exchange,
                this.info,
                formattedPrivateKey,
                this.exchangeToInternalNameMap,
                this.assetToIndexMap,
                this.initializationPromise
            );
            this.isValidPrivateKey = true;
        } catch (error) {
            console.warn('Invalid private key provided. Some functionalities will be limited.');
            this.isValidPrivateKey = false;
        }
    }

    /**
     * Refreshes the asset-to-index and exchange-to-internal name mappings.
     */
    private async refreshAssetToIndexMap(): Promise<void> {
        try {
            const [perpMetaResponse, spotMetaResponse] = await Promise.all([
                this.httpApi.makeRequest({ type: INFO_TYPES.PERPS_META_AND_ASSET_CTXS }),
                this.httpApi.makeRequest({ type: INFO_TYPES.SPOT_META_AND_ASSET_CTXS }),
            ]);

            this.assetToIndexMap.clear();
            this.exchangeToInternalNameMap.clear();

            this.processPerpetualAssets(perpMetaResponse);
            this.processSpotAssets(spotMetaResponse);

            console.log('Asset maps refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh asset maps:', error);
        }
    }

    /**
     * Processes perpetual assets data and updates the relevant maps.
     * @param perpMetaResponse - The response containing perpetual assets metadata.
     */
    private processPerpetualAssets(perpMetaResponse: any): void {
        if (Array.isArray(perpMetaResponse) && perpMetaResponse.length > 0 && perpMetaResponse[0].universe) {
            perpMetaResponse[0].universe.forEach((asset: { name: string }, index: number) => {
                const internalName = `${asset.name}-PERP`;
                this.assetToIndexMap.set(internalName, index);
                this.exchangeToInternalNameMap.set(asset.name, internalName);
            });
        }
    }

    /**
     * Processes spot assets data and updates the relevant maps.
     * @param spotMetaResponse - The response containing spot assets' metadata.
     */
    private processSpotAssets(spotMetaResponse: any): void {
        if (Array.isArray(spotMetaResponse) && spotMetaResponse.length > 0 && spotMetaResponse[0].universe) {
            spotMetaResponse[0].universe.forEach((market: { name: string; tokens: number[] }, index: number) => {
                if (spotMetaResponse[0].tokens && Array.isArray(spotMetaResponse[0].tokens)) {
                    const baseToken = spotMetaResponse[0].tokens[market.tokens[0]];
                    if (baseToken && baseToken.name) {
                        const internalName = `${baseToken.name}-SPOT`;
                        this.assetToIndexMap.set(internalName, 10000 + index);
                        this.exchangeToInternalNameMap.set(market.name, internalName);
                    }
                }
            });
        }
    }

    /**
     * Gets the internal name for a given exchange asset name.
     * @param exchangeName - The exchange asset name.
     * @returns The corresponding internal asset name, or undefined if not found.
     */
    public getInternalName(exchangeName: string): string | undefined {
        return this.exchangeToInternalNameMap.get(exchangeName);
    }

    /**
     * Gets the exchange name for a given internal asset name.
     * @param internalName - The internal asset name.
     * @returns The corresponding exchange asset name, or undefined if not found.
     */
    public getExchangeName(internalName: string): string | undefined {
        return Array.from(this.exchangeToInternalNameMap.entries()).find(([, name]) => name === internalName)?.[0];
    }

    /**
     * Initializes the API by refreshing asset mappings and starting periodic refresh.
     */
    private async initialize(): Promise<void> {
        await this.refreshAssetToIndexMap();
        this.startPeriodicRefresh();
    }

    /**
     * Ensures that the API is fully initialized before performing certain operations.
     * @returns A promise that resolves when initialization is complete.
     */
    async ensureInitialized(): Promise<void> {
        return this.initializationPromise;
    }

    /**
     * Starts the periodic refresh of asset mappings.
     */
    private startPeriodicRefresh(): void {
        this.refreshInterval = setInterval(() => this.refreshAssetToIndexMap(), this.refreshIntervalMs);
    }

    /**
     * Gets the asset index for a given asset symbol.
     * @param assetSymbol - The asset symbol to look up.
     * @returns The corresponding asset index, or undefined if not found.
     */
    public getAssetIndex(assetSymbol: string): number | undefined {
        return this.assetToIndexMap.get(assetSymbol);
    }

    /**
     * Gets all available assets, separated into perpetual and spot categories.
     * @returns An object containing arrays of perpetual and spot asset names.
     */
    public getAllAssets(): { perp: string[]; spot: string[] } {
        const assets: { perp: string[]; spot: string[] } = { perp: [], spot: [] };
        for (const asset of this.assetToIndexMap.keys()) {
            if (asset.endsWith('-PERP')) {
                assets.perp.push(asset);
            } else if (asset.endsWith('-SPOT')) {
                assets.spot.push(asset);
            }
        }
        return assets;
    }

    /**
     * Checks if the API is authenticated with a valid private key.
     * @returns True if authenticated, false otherwise.
     */
    public isAuthenticated(): boolean {
        return this.isValidPrivateKey;
    }

    /**
     * Connects to the WebSocket server.
     * @returns A promise that resolves when the connection is established.
     */
    async connect(): Promise<void> {
        await this.ws.connect();
        if (!this.isValidPrivateKey) {
            console.warn('Not authenticated. Some WebSocket functionalities may be limited.');
        }
    }

    /**
     * Disconnects from the WebSocket server and stops the periodic refresh of asset mappings.
     */
    disconnect(): void {
        this.ws.close();
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

export * from './types';
export * from './utils/signing';
