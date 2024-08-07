import { ethers } from 'ethers';
import { GeneralInfoAPI } from './info/general';
import { ExchangeAPI } from './exchange';
import type { UserOpenOrders, CancelOrderRequest } from '../types';
import type { CancelOrderResponse } from '../utils/signing';

export class CustomOperations {
    private readonly exchange: ExchangeAPI;
    private readonly infoApi: GeneralInfoAPI;
    private readonly wallet: ethers.Wallet;
    private readonly exchangeToInternalNameMap: Map<string, string>;
    private readonly assetToIndexMap: Map<string, number>;
    private readonly initializationPromise: Promise<void>;

    constructor(
        exchange: ExchangeAPI,
        infoApi: GeneralInfoAPI,
        privateKey: string,
        exchangeToInternalNameMap: Map<string, string>,
        assetToIndexMap: Map<string, number>,
        initializationPromise: Promise<void>
    ) {
        this.exchange = exchange;
        this.infoApi = infoApi;
        this.wallet = new ethers.Wallet(privateKey);
        this.exchangeToInternalNameMap = exchangeToInternalNameMap;
        this.initializationPromise = initializationPromise;
        this.assetToIndexMap = assetToIndexMap;
    }

    private async ensureInitialized(): Promise<void> {
        await this.initializationPromise;
    }

    async cancelAllOrders(symbol?: string): Promise<CancelOrderResponse> {
        try {
            await this.ensureInitialized();
            const openOrders: UserOpenOrders = await this.infoApi.getUserOpenOrders(this.wallet.address);

            const ordersToCancel = openOrders
                .map(order => ({
                    ...order,
                    coin: this.exchangeToInternalNameMap.get(order.coin) || order.coin,
                }))
                .filter(order => !symbol || order.coin === symbol);

            if (ordersToCancel.length === 0) {
                throw new Error('No orders to cancel');
            }

            const cancelRequests: CancelOrderRequest[] = ordersToCancel.map(order => ({
                coin: order.coin,
                o: order.oid,
            }));

            return this.exchange.cancelOrder(cancelRequests);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to cancel orders: ${error.message}`);
            } else {
                throw new Error('Failed to cancel orders: Unknown error');
            }
        }
    }

    getAllAssets(): { perp: string[]; spot: string[] } {
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
}
