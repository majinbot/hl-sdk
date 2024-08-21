import { WebSocketClient } from './connection';
import { SymbolConverter } from '../utils/symbolConverter';
import type {
    AllMids,
    WsTrade,
    WsBook,
    WsOrder,
    WsUserEvent,
    Notification,
    WebData2,
    Candle,
    WsUserFills,
    WsUserFundings,
    WsUserNonFundingLedgerUpdates,
    WsSubscriptionMessage,
} from '../types';

export const WS_TIMEOUT = 30_000; // 30s

export class WebSocketSubscriptions {
    private ws: WebSocketClient;
    private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
    private symbolConverter: SymbolConverter;

    constructor(ws: WebSocketClient, symbolConverter: SymbolConverter) {
        this.ws = ws;
        this.symbolConverter = symbolConverter;
        this.ws.on('message', this.handleMessage.bind(this));
    }

    private async subscribe(subscription: WsSubscriptionMessage['subscription']): Promise<void> {
        try {
            await this.ws.sendMessage({ method: 'subscribe', subscription });
        } catch (error) {
            console.error(`Failed to subscribe to ${subscription.type}:`, error);
            throw error;
        }
    }

    private async unsubscribe(subscription: WsSubscriptionMessage['subscription']): Promise<void> {
        try {
            await this.ws.sendMessage({ method: 'unsubscribe', subscription });
        } catch (error) {
            console.error(`Failed to unsubscribe from ${subscription.type}:`, error);
            throw error;
        }
    }

    private handleMessage(message: any): void {
        const { channel, data } = message;
        if (this.subscriptions.has(channel)) {
            const convertedData = this.symbolConverter.convertSymbolsInObject(data);
            this.subscriptions.get(channel)?.forEach(callback => callback(convertedData));
        }
    }

    private addSubscription(channel: string, callback: (data: any) => void): void {
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
        }
        this.subscriptions.get(channel)?.add(callback);
    }

    private removeSubscription(channel: string, callback: (data: any) => void): void {
        this.subscriptions.get(channel)?.delete(callback);
        if (this.subscriptions.get(channel)?.size === 0) {
            this.subscriptions.delete(channel);
        }
    }

    async subscribeToAllMids(callback: (data: AllMids) => void): Promise<void> {
        await this.subscribe({ type: 'allMids' });
        this.addSubscription('allMids', callback);
    }

    async subscribeToNotification(user: string, callback: (data: Notification) => void): Promise<void> {
        await this.subscribe({ type: 'notification', user });
        this.addSubscription('notification', callback);
    }

    async subscribeToWebData2(user: string, callback: (data: WebData2) => void): Promise<void> {
        await this.subscribe({ type: 'webData2', user });
        this.addSubscription('webData2', callback);
    }

    async subscribeToCandle(coin: string, interval: string, callback: (data: Candle[]) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.subscribe({ type: 'candle', coin: convertedCoin, interval });
        this.ws.on('message', (message: any) => {
            if (message.channel === 'candle' && message.data.s === convertedCoin && message.data.i === interval) {
                const convertedData = this.symbolConverter.convertSymbolsInObject(message.data, ['s']);
                callback([convertedData]); // Wrap the single Candle in an array
            }
        });
    }

    async subscribeToL2Book(coin: string, callback: (data: WsBook) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.subscribe({ type: 'l2Book', coin: convertedCoin });
        this.addSubscription('l2Book', callback);
    }

    async subscribeToTrades(coin: string, callback: (data: WsTrade[]) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.subscribe({ type: 'trades', coin: convertedCoin });
        this.addSubscription('trades', callback);
    }

    async subscribeToOrderUpdates(user: string, callback: (data: WsOrder[]) => void): Promise<void> {
        await this.subscribe({ type: 'orderUpdates', user });
        this.addSubscription('orderUpdates', callback);
    }

    async subscribeToUserEvents(user: string, callback: (data: WsUserEvent) => void): Promise<void> {
        await this.subscribe({ type: 'userEvents', user });
        this.addSubscription('userEvents', callback);
    }

    async subscribeToUserFills(user: string, callback: (data: WsUserFills) => void): Promise<void> {
        await this.subscribe({ type: 'userFills', user });
        this.addSubscription('userFills', callback);
    }

    async subscribeToUserFundings(user: string, callback: (data: WsUserFundings) => void): Promise<void> {
        await this.subscribe({ type: 'userFundings', user });
        this.addSubscription('userFundings', callback);
    }

    async subscribeToUserNonFundingLedgerUpdates(
        user: string,
        callback: (data: WsUserNonFundingLedgerUpdates) => void
    ): Promise<void> {
        await this.subscribe({ type: 'userNonFundingLedgerUpdates', user });
        this.addSubscription('userNonFundingLedgerUpdates', callback);
    }

    async postRequest(requestType: 'info' | 'action', payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = Date.now();
            const convertedPayload = this.symbolConverter.convertSymbolsInObject(payload);
            this.ws
                .sendMessage({
                    method: 'post',
                    id,
                    request: {
                        type: requestType,
                        payload: convertedPayload,
                    },
                })
                .catch(error => {
                    reject(error);
                });

            const responseHandler = (message: any) => {
                if (message.channel === 'post' && message.data.id === id) {
                    this.ws.removeListener('message', responseHandler);
                    if (message.data.response.type === 'error') {
                        reject(new Error(message.data.response.payload));
                    } else {
                        const convertedResponse = this.symbolConverter.convertSymbolsInObject(
                            message.data.response.payload
                        );
                        resolve(convertedResponse);
                    }
                }
            };

            this.ws.on('message', responseHandler);

            setTimeout(() => {
                this.ws.removeListener('message', responseHandler);
                reject(new Error('Request timeout'));
            }, WS_TIMEOUT);
        });
    }

    async unsubscribeFromAllMids(callback: (data: AllMids) => void): Promise<void> {
        await this.unsubscribe({ type: 'allMids' });
        this.removeSubscription('allMids', callback);
    }

    async unsubscribeFromNotification(user: string, callback: (data: Notification) => void): Promise<void> {
        await this.unsubscribe({ type: 'notification', user });
        this.removeSubscription('notification', callback);
    }

    async unsubscribeFromWebData2(user: string, callback: (data: WebData2) => void): Promise<void> {
        await this.unsubscribe({ type: 'webData2', user });
        this.removeSubscription('webData2', callback);
    }

    async unsubscribeFromCandle(coin: string, interval: string, callback: (data: Candle[]) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.unsubscribe({ type: 'candle', coin: convertedCoin, interval });
        this.removeSubscription('candle', callback);
    }

    async unsubscribeFromL2Book(coin: string, callback: (data: WsBook) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.unsubscribe({ type: 'l2Book', coin: convertedCoin });
        this.removeSubscription('l2Book', callback);
    }

    async unsubscribeFromTrades(coin: string, callback: (data: WsTrade[]) => void): Promise<void> {
        const convertedCoin = this.symbolConverter.convertSymbol(coin, 'reverse');
        await this.unsubscribe({ type: 'trades', coin: convertedCoin });
        this.removeSubscription('trades', callback);
    }

    async unsubscribeFromOrderUpdates(user: string, callback: (data: WsOrder[]) => void): Promise<void> {
        await this.unsubscribe({ type: 'orderUpdates', user });
        this.removeSubscription('orderUpdates', callback);
    }

    async unsubscribeFromUserEvents(user: string, callback: (data: WsUserEvent) => void): Promise<void> {
        await this.unsubscribe({ type: 'userEvents', user });
        this.removeSubscription('userEvents', callback);
    }

    async unsubscribeFromUserFills(user: string, callback: (data: WsUserFills) => void): Promise<void> {
        await this.unsubscribe({ type: 'userFills', user });
        this.removeSubscription('userFills', callback);
    }

    async unsubscribeFromUserFundings(user: string, callback: (data: WsUserFundings) => void): Promise<void> {
        await this.unsubscribe({ type: 'userFundings', user });
        this.removeSubscription('userFundings', callback);
    }

    async unsubscribeFromUserNonFundingLedgerUpdates(
        user: string,
        callback: (data: WsUserNonFundingLedgerUpdates) => void
    ): Promise<void> {
        await this.unsubscribe({ type: 'userNonFundingLedgerUpdates', user });
        this.removeSubscription('userNonFundingLedgerUpdates', callback);
    }
}
