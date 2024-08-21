import { Wallet } from 'ethers';
import { InfoAPI } from './rest/info';
import { ExchangeAPI } from './rest/exchange';
import { WebSocketClient } from './websocket/connection';
import { WebSocketSubscriptions } from './websocket/subscriptions';
import { RateLimiter } from './utils/rateLimiter';
import { HttpApi } from './utils/helpers';
import { BASE_URLS, ENDPOINTS } from './constants';
import { CustomOperations } from './rest/custom';
import { IS_MAINNET } from './config';
import { SymbolConverter } from './utils/symbolConverter';
import { AuthenticationError } from './utils/errors';
import { LeaderboardAPI } from './rest/info/leaderboard.ts';
import { GeneralInfoAPI } from './rest/info/general.ts';
import { SpotInfoAPI } from './rest/info/spot.ts';
import { PerpsInfoAPI } from './rest/info/perps.ts';

export class HyperliquidAPI {
    public readonly info: InfoAPI;
    public readonly ws: WebSocketClient;
    public readonly subscriptions: WebSocketSubscriptions;

    public readonly rateLimiter: RateLimiter;
    public readonly symbolConverter: SymbolConverter;
    public readonly httpApi: HttpApi;
    public readonly generalApi: GeneralInfoAPI;
    public readonly spotApi: SpotInfoAPI;
    public readonly perpsApi: PerpsInfoAPI;
    public readonly leaderboard: LeaderboardAPI;

    private refreshInterval: Timer | undefined;
    private readonly refreshIntervalMs: number = 60_000;
    private isAuthenticated: boolean = false;

    public exchange: ExchangeAPI | null = null;
    public custom: CustomOperations | null = null;

    constructor(privateKey: string | null = null, isMainnet: boolean = IS_MAINNET) {
        const baseURL = isMainnet ? BASE_URLS.MAINNET : BASE_URLS.TESTNET;
        this.rateLimiter = new RateLimiter();
        this.httpApi = new HttpApi(baseURL, ENDPOINTS.INFO, this.rateLimiter);
        this.symbolConverter = new SymbolConverter();

        this.info = new InfoAPI(this.httpApi);
        this.ws = new WebSocketClient(!isMainnet);
        this.subscriptions = new WebSocketSubscriptions(this.ws, this.symbolConverter);

        this.generalApi = new GeneralInfoAPI(this.httpApi, this.symbolConverter);
        this.spotApi = new SpotInfoAPI(this.httpApi, this.symbolConverter);
        this.perpsApi = new PerpsInfoAPI(this.httpApi, this.symbolConverter);
        this.leaderboard = new LeaderboardAPI(this.httpApi, this.generalApi, this.spotApi, this.perpsApi);

        if (privateKey) {
            this.initializeWithPrivateKey(privateKey, baseURL);
        }

        this.initialize().then(() => console.log('HL API initialized'));
    }

    private initializeWithPrivateKey(privateKey: string, baseURL: string): void {
        try {
            const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            new Wallet(formattedPrivateKey); // Validate the private key

            this.exchange = new ExchangeAPI(this.httpApi, this.info, formattedPrivateKey);
            this.custom = new CustomOperations(this.exchange, this.info, formattedPrivateKey);
            this.isAuthenticated = true;
        } catch (error) {
            console.warn('Invalid private key provided. Some functionalities will be limited.');
            this.isAuthenticated = false;
        }
    }

    private async initialize(): Promise<void> {
        await this.info.refreshAssetMaps();
        this.startPeriodicRefresh();
    }

    private startPeriodicRefresh(): void {
        this.refreshInterval = setInterval(() => this.info.refreshAssetMaps(), this.refreshIntervalMs);
    }

    public async ensureInitialized(): Promise<void> {
        await this.info.refreshAssetMaps();
    }

    public getAssetIndex(assetName: string): number | undefined {
        return this.symbolConverter.getAssetIndex(assetName);
    }

    public getInternalName(exchangeName: string): string | undefined {
        return this.symbolConverter.getInternalName(exchangeName);
    }

    public getAllAssets(): { perp: string[]; spot: string[] } {
        return this.symbolConverter.getAllAssets();
    }

    public isAuthenticatedUser(): boolean {
        return this.isAuthenticated;
    }

    public async connect(): Promise<void> {
        await this.ws.connect();
        if (!this.isAuthenticated) {
            console.warn('Not authenticated. Some WebSocket functionalities may be limited.');
        }
    }

    public disconnect(): void {
        this.ws.close();
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = undefined;
        }
    }

    public getExchange(): ExchangeAPI {
        if (!this.exchange) {
            throw new AuthenticationError('ExchangeAPI is not available. Authentication required.');
        }
        return this.exchange;
    }

    public getCustom(): CustomOperations {
        if (!this.custom) {
            throw new AuthenticationError('CustomOperations is not available. Authentication required.');
        }
        return this.custom;
    }
}
