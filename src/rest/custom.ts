import { ethers } from 'ethers';
import { InfoAPI } from './info';
import { ExchangeAPI } from './exchange';
import type { UserOpenOrders, CancelOrderRequest } from '../types';
import type { CancelOrderResponse } from '../utils/signing';
import { SymbolConverter } from '../utils/symbolConverter';

export class CustomOperations {
    private readonly exchange: ExchangeAPI;
    private readonly infoApi: InfoAPI;
    private readonly wallet: ethers.Wallet;

    constructor(exchange: ExchangeAPI, infoApi: InfoAPI, privateKey: string) {
        this.exchange = exchange;
        this.infoApi = infoApi;
        this.wallet = new ethers.Wallet(privateKey);
    }

    async cancelAllOrders(symbol?: string): Promise<CancelOrderResponse> {
        try {
            const openOrders: UserOpenOrders = await this.infoApi.getUserOpenOrders(this.wallet.address);

            const ordersToCancel = openOrders
                .map(order => ({
                    ...order,
                    coin: this.infoApi.convertSymbol(order.coin) || order.coin,
                }))
                .filter(order => !symbol || order.coin === symbol);

            if (ordersToCancel.length === 0) {
                throw new Error('CustomOperations: No orders to cancel');
            }

            const cancelRequests: CancelOrderRequest[] = ordersToCancel.map(order => ({
                coin: order.coin,
                o: order.oid,
            }));

            return this.exchange.cancelOrder(cancelRequests);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`CustomOperations: Failed to cancel orders: ${error.message}`);
            } else {
                throw new Error('CustomOperations: Failed to cancel orders: Unknown error');
            }
        }
    }

    getAllAssets(): { perp: string[]; spot: string[] } {
        return this.infoApi.getAllAssets();
    }
}
