import { InfoAPI } from './rest/info';
import { ExchangeAPI } from './rest/exchange';
import { WebSocketClient } from './websocket/connection';
import { WebSocketSubscriptions } from './websocket/subscriptions';
import { RateLimiter } from './utils/rateLimiter';
import { HttpApi } from './utils/helpers';
import { BASE_URLS, ENDPOINTS, INFO_TYPES } from './constants';
import { CustomOperations } from './rest/custom';
import { Wallet } from 'ethers';
import { IS_MAINNET } from './config';
import {LeaderboardAPI} from "./rest/info/leaderboard.ts";

class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class HyperliquidAPI {
    public info: InfoAPI;
    public exchange: ExchangeAPI;
    public ws: WebSocketClient;
    public subscriptions: WebSocketSubscriptions;
    public custom: CustomOperations;
    public leaderboard: LeaderboardAPI;

    private readonly rateLimiter: RateLimiter;
    private readonly assetToIndexMap: Map<string, number>;
    private refreshInterval: Timer | null = null;
    private refreshIntervalMs: number = 60000;
    private readonly initializationPromise: Promise<void>;
    private readonly exchangeToInternalNameMap: Map<string, string>;
    private readonly httpApi: HttpApi;
    private isValidPrivateKey: boolean = false;

    constructor(privateKey: string | null = null) {
        const baseURL = IS_MAINNET ? BASE_URLS.PRODUCTION : BASE_URLS.TESTNET;

        this.rateLimiter = new RateLimiter();
        this.assetToIndexMap = new Map();
        this.exchangeToInternalNameMap = new Map();
        this.httpApi = new HttpApi(baseURL, ENDPOINTS.INFO, this.rateLimiter);

        this.initializationPromise = this.initialize();

        this.info = new InfoAPI(baseURL, this.rateLimiter, this.assetToIndexMap, this.exchangeToInternalNameMap, this.initializationPromise);
        this.ws = new WebSocketClient(!IS_MAINNET);
        this.subscriptions = new WebSocketSubscriptions(this.ws);

        // Create proxy objects for exchange and custom
        this.exchange = this.createAuthenticatedProxy(ExchangeAPI);
        this.custom = this.createAuthenticatedProxy(CustomOperations);
        this.leaderboard = new LeaderboardAPI(this.httpApi);

        if (privateKey) {
            this.initializeWithPrivateKey(privateKey, baseURL);
        }
    }

    private createAuthenticatedProxy<T extends object>(Class: new (...args: any[]) => T): T {
        return new Proxy({} as T, {
            get: (target, prop) => {
                if (!this.isValidPrivateKey) {
                    throw new AuthenticationError('Invalid or missing private key. This method requires authentication.');
                }
                return target[prop as keyof T];
            }
        });
    }

    private initializeWithPrivateKey(privateKey: string, baseURL: string): void {
        try {
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            new Wallet(formattedPrivateKey); // Validate the private key

            this.exchange = new ExchangeAPI(baseURL, formattedPrivateKey, this.rateLimiter, this.assetToIndexMap, this.exchangeToInternalNameMap, this.initializationPromise);
            this.custom = new CustomOperations(this.exchange, this.info, formattedPrivateKey, this.exchangeToInternalNameMap, this.assetToIndexMap, this.initializationPromise);
            this.isValidPrivateKey = true;
        } catch (error) {
            console.warn("Invalid private key provided. Some functionalities will be limited.");
            this.isValidPrivateKey = false;
        }
    }

    private async refreshAssetToIndexMap(): Promise<void> {
        try {
            // Fetch both perpetual and spot metadata concurrently for efficiency
            const [perpMeta, spotMeta] = await Promise.all([
                this.httpApi.makeRequest({ type: INFO_TYPES.PERPS_META_AND_ASSET_CTXS }),
                this.httpApi.makeRequest({ type: INFO_TYPES.SPOT_META_AND_ASSET_CTXS })
            ]);

            // Clear existing maps to ensure we're working with fresh data
            this.assetToIndexMap.clear();
            this.exchangeToInternalNameMap.clear();

            // Handle perpetual assets
            if (perpMeta && perpMeta.meta && Array.isArray(perpMeta.meta.universe)) {
                perpMeta.meta.universe.forEach((asset: { name: string }, index: number) => {
                    // Create an internal name for the perpetual asset by appending '-PERP'
                    const internalName = `${asset.name}-PERP`;
                    // Map the internal name to its index in the universe array
                    this.assetToIndexMap.set(internalName, index);
                    // Map the exchange name to our internal name for easy lookup
                    this.exchangeToInternalNameMap.set(asset.name, internalName);
                });
            }

            // Handle spot assets
            if (spotMeta && spotMeta.meta && Array.isArray(spotMeta.meta.universe)) {
                spotMeta.meta.universe.forEach((market: any, index: number) => {
                    // Check if the market has tokens and the tokens array exists in the metadata
                    if (spotMeta.meta.tokens && Array.isArray(spotMeta.meta.tokens) && market.tokens && market.tokens.length > 0) {
                        // Get the token object for the first token in the market
                        const token = spotMeta.meta.tokens[market.tokens[0]];
                        if (token && token.name) {
                            // Create an internal name for the spot asset by appending '-SPOT'
                            const internalName = `${token.name}-SPOT`;
                            // Map the internal name to its index, offsetting by 10000 to avoid conflicts with perp indices
                            this.assetToIndexMap.set(internalName, 10000 + index);
                            // Map the market name to our internal name for easy lookup
                            this.exchangeToInternalNameMap.set(market.name, internalName);
                        }
                    }
                });
            }
        } catch (error) {
            // Log any errors that occur during the refresh process
            console.error('Failed to refresh asset maps:', error);
        }
    }

    public getInternalName(exchangeName: string): string | undefined {
        return this.exchangeToInternalNameMap.get(exchangeName);
    }

    public getExchangeName(internalName: string): string | undefined {
        for (const [exchangeName, name] of this.exchangeToInternalNameMap.entries()) {
            if (name === internalName) {
                return exchangeName;
            }
        }
        return undefined;
    }

    private async initialize(): Promise<void> {
        await this.refreshAssetToIndexMap();
        await this.startPeriodicRefresh();
    }

    async ensureInitialized(): Promise<void> {
        return this.initializationPromise;
    }

    private async startPeriodicRefresh(): Promise<void> {
        this.refreshInterval = setInterval(() => {
            this.refreshAssetToIndexMap();
        }, this.refreshIntervalMs);
    }

    public getAssetIndex(assetSymbol: string): number | undefined {
        return this.assetToIndexMap.get(assetSymbol);
    }

    public getAllAssets(): { perp: string[], spot: string[] } {
        const perp: string[] = [];
        const spot: string[] = [];

        for (const asset of this.assetToIndexMap.keys()) {
            if (asset.endsWith('-PERP')) {
                perp.push(asset);
            } else if (asset.endsWith('-SPOT')) {
                spot.push(asset);
            }
        }

        return { perp, spot };
    }

    public isAuthenticated(): boolean {
        return this.isValidPrivateKey;
    }

    async connect(): Promise<void> {
        await this.ws.connect();
        if (!this.isValidPrivateKey) {
            console.warn("Not authenticated. Some WebSocket functionalities may be limited.");
        }
    }

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