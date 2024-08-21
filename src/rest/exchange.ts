import { ethers } from 'ethers';
import {
    signL1Action,
    orderRequestToOrderWire,
    orderWiresToOrderAction,
    signUserSignedAction,
    signUsdTransferAction,
    signWithdrawFromBridgeAction,
    type CancelOrderResponse,
} from '../utils/signing';
import type { CancelOrderRequest, OrderRequest } from '../types';
import { EXCHANGE_TYPES } from '../constants';
import { IS_MAINNET } from '../config.ts';
import type { InfoAPI } from './info.ts';
import type { HttpApi } from '../utils/helpers.ts';

export class ExchangeAPI {
    private readonly wallet: ethers.Wallet;

    constructor(protected httpApi: HttpApi, private readonly infoAPI: InfoAPI, privateKey: string) {
        this.wallet = new ethers.Wallet(privateKey);
    }

    private async getAssetIndex(symbol: string): Promise<number> {
        const index = this.infoAPI.getAssetIndex(symbol);
        if (index === undefined) {
            throw new Error(`Unknown asset: ${symbol}`);
        }
        return index;
    }

    async placeOrder(orderRequest: OrderRequest): Promise<any> {
        try {
            const assetIndex = await this.getAssetIndex(orderRequest.coin);
            const orderWire = orderRequestToOrderWire(orderRequest, assetIndex);
            const action = orderWiresToOrderAction([orderWire]);
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to place order: ${error.message}`);
        }
    }

    async cancelOrder(cancelRequests: CancelOrderRequest | CancelOrderRequest[]): Promise<CancelOrderResponse> {
        try {
            const cancels = Array.isArray(cancelRequests) ? cancelRequests : [cancelRequests];

            const cancelsWithIndices = await Promise.all(
                cancels.map(async req => ({
                    ...req,
                    a: await this.getAssetIndex(req.coin),
                }))
            );

            const action = {
                type: EXCHANGE_TYPES.CANCEL,
                cancels: cancelsWithIndices.map(({ a, o }) => ({ a, o })),
            };

            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to cancel order: ${error.message}`);
        }
    }

    async cancelOrderByCloid(symbol: string, cloid: string): Promise<any> {
        try {
            const assetIndex = await this.getAssetIndex(symbol);
            const action = {
                type: EXCHANGE_TYPES.CANCEL_BY_CLOID,
                cancels: [{ asset: assetIndex, cloid }],
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to cancel order by CLOID: ${error.message}`);
        }
    }

    async modifyOrder(oid: number, orderRequest: OrderRequest): Promise<any> {
        try {
            const assetIndex = await this.getAssetIndex(orderRequest.coin);
            const orderWire = orderRequestToOrderWire(orderRequest, assetIndex);
            const action = {
                type: EXCHANGE_TYPES.MODIFY,
                oid,
                order: orderWire,
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to modify order: ${error.message}`);
        }
    }

    async batchModifyOrders(modifies: Array<{ oid: number; order: OrderRequest }>): Promise<any> {
        try {
            const assetIndices = await Promise.all(modifies.map(m => this.getAssetIndex(m.order.coin)));

            const action = {
                type: EXCHANGE_TYPES.BATCH_MODIFY,
                modifies: modifies.map((m, index) => ({
                    oid: m.oid,
                    order: orderRequestToOrderWire(m.order, assetIndices[index]),
                })),
            };

            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to batch modify orders: ${error.message}`);
        }
    }

    async updateLeverage(symbol: string, leverageMode: string, leverage: number): Promise<any> {
        try {
            const assetIndex = await this.getAssetIndex(symbol);
            const action = {
                type: EXCHANGE_TYPES.UPDATE_LEVERAGE,
                asset: assetIndex,
                isCross: leverageMode === 'cross',
                leverage: leverage,
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to update leverage: ${error.message}`);
        }
    }

    async updateIsolatedMargin(symbol: string, isBuy: boolean, ntli: number): Promise<any> {
        try {
            const assetIndex = await this.getAssetIndex(symbol);
            const action = {
                type: EXCHANGE_TYPES.UPDATE_ISOLATED_MARGIN,
                asset: assetIndex,
                isBuy,
                ntli,
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to update isolated margin: ${error.message}`);
        }
    }

    async usdTransfer(destination: string, amount: number): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.USD_SEND,
                hyperliquidChain: IS_MAINNET ? 'Mainnet' : 'Testnet',
                signatureChainId: '0xa4b1',
                destination: destination,
                amount: amount.toString(),
                time: Date.now(),
            };
            const signature = await signUsdTransferAction(this.wallet, action);

            const payload = { action, nonce: action.time, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to transfer USD: ${error.message}`);
        }
    }

    async spotTransfer(destination: string, token: string, amount: string): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.SPOT_SEND,
                hyperliquidChain: IS_MAINNET ? 'Mainnet' : 'Testnet',
                signatureChainId: '0xa4b1',
                destination,
                token,
                amount,
                time: Date.now(),
            };
            const signature = await signUserSignedAction(
                this.wallet,
                action,
                [
                    { name: 'hyperliquidChain', type: 'string' },
                    { name: 'destination', type: 'string' },
                    { name: 'token', type: 'string' },
                    { name: 'amount', type: 'string' },
                    { name: 'time', type: 'uint64' },
                ],
                'HyperliquidTransaction:SpotSend'
            );

            const payload = { action, nonce: action.time, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to transfer SPOT asset: ${error.message}`);
        }
    }

    async initiateWithdrawal(destination: string, amount: number): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.WITHDRAW,
                hyperliquidChain: IS_MAINNET ? 'Mainnet' : 'Testnet',
                signatureChainId: '0xa4b1',
                destination: destination,
                amount: amount.toString(),
                time: Date.now(),
            };
            const signature = await signWithdrawFromBridgeAction(this.wallet, action);

            const payload = { action, nonce: action.time, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to initiate withdrawal: ${error.message}`);
        }
    }

    async transferBetweenSpotAndPerp(usdc: number, toPerp: boolean): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.SPOT_USER,
                classTransfer: {
                    usdc: usdc * 1e6,
                    toPerp: toPerp,
                },
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to transfer between SPOT and PERP: ${error.message}`);
        }
    }

    async scheduleCancel(time: number | null): Promise<any> {
        try {
            const action = { type: EXCHANGE_TYPES.SCHEDULE_CANCEL, time };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to schedule cancel: ${error.message}`);
        }
    }

    async vaultTransfer(vaultAddress: string, isDeposit: boolean, usd: number): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.VAULT_TRANSFER,
                vaultAddress,
                isDeposit,
                usd,
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to transfer to/from vault: ${error.message}`);
        }
    }

    async setReferrer(code: string): Promise<any> {
        try {
            const action = {
                type: EXCHANGE_TYPES.SET_REFERRER,
                code,
            };
            const nonce = Date.now();
            const signature = await signL1Action(this.wallet, action, null, nonce);

            const payload = { action, nonce, signature };
            return this.httpApi.makeRequest(payload, 1);
        } catch (error: any) {
            throw new Error(`Failed to set referrer: ${error.message}`);
        }
    }
}
