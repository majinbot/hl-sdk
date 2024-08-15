import { WebSocketClient } from './connection';
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

export class WebSocketSubscriptions {
    private ws: WebSocketClient;
    private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
    private exchangeToInternalNameMap: Map<string, string>;
    private initializationPromise: Promise<void>;

    constructor(
        ws: WebSocketClient,
        exchangeToInternalNameMap: Map<string, string>,
        initializationPromise: Promise<void>
    ) {
        this.ws = ws;
        this.exchangeToInternalNameMap = exchangeToInternalNameMap;
        this.initializationPromise = initializationPromise;
        this.ws.on('message', this.handleMessage.bind(this));
    }

    private async ensureInitialized() {
        await this.initializationPromise;
    }

    private subscribe(subscription: WsSubscriptionMessage['subscription']): void {
        this.ws.sendMessage({ method: 'subscribe', subscription });
    }

    private unsubscribe(subscription: WsSubscriptionMessage['subscription']): void {
        this.ws.sendMessage({ method: 'unsubscribe', subscription });
    }

    private handleMessage(message: any): void {
        const { channel, data } = message;
        if (this.subscriptions.has(channel)) {
            const convertedData = this.convertSymbolsInObject(data);
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

    private convertSymbol(symbol: string, mode: string = '', symbolMode: string = ''): string {
        let rSymbol;
        if (mode === 'reverse') {
            rSymbol =
                Array.from(this.exchangeToInternalNameMap.entries()).find(([, value]) => value === symbol)?.[0] ||
                symbol;
        } else {
            rSymbol = this.exchangeToInternalNameMap.get(symbol) || symbol;
        }

        if (symbolMode === 'SPOT' && !rSymbol.endsWith('-SPOT')) {
            rSymbol = `${symbol}-SPOT`;
        } else if (symbolMode === 'PERP' && !rSymbol.endsWith('-PERP')) {
            rSymbol = `${symbol}-PERP`;
        }

        return rSymbol;
    }

    private convertSymbolsInObject(
        obj: any,
        symbolsFields: string[] = ['coin', 'symbol'],
        symbolMode: string = ''
    ): any {
        if (typeof obj !== 'object' || obj === null) {
            return this.convertToNumber(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.convertSymbolsInObject(item, symbolsFields, symbolMode));
        }

        const convertedObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (symbolsFields.includes(key)) {
                convertedObj[key] = this.convertSymbol(value as string, '', symbolMode);
            } else if (key === 'side') {
                convertedObj[key] = value === 'A' ? 'sell' : value === 'B' ? 'buy' : value;
            } else {
                convertedObj[key] = this.convertSymbolsInObject(value, symbolsFields, symbolMode);
            }
        }
        return convertedObj;
    }

    private convertToNumber(value: any): any {
        if (typeof value === 'string') {
            if (/^-?\d+$/.test(value)) {
                return parseInt(value, 10);
            } else if (/^-?\d*\.\d+$/.test(value)) {
                return parseFloat(value);
            }
        }
        return value;
    }

    async subscribeToAllMids(callback: (data: AllMids) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'allMids' });
        this.addSubscription('allMids', callback);
    }

    async subscribeToNotification(user: string, callback: (data: Notification) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'notification', user });
        this.addSubscription('notification', callback);
    }

    async subscribeToWebData2(user: string, callback: (data: WebData2) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'webData2', user });
        this.addSubscription('webData2', callback);
    }

    async subscribeToCandle(coin: string, interval: string, callback: (data: Candle[]) => void): Promise<void> {
        await this.ensureInitialized();
        const convertedCoin = this.convertSymbol(coin, "reverse");
        this.subscribe({ type: 'candle', coin: convertedCoin, interval });
        this.ws.on('message', (message: any) => {
            if (message.channel === 'candle' && message.data.s === convertedCoin && message.data.i === interval) {
                const convertedData = this.convertSymbolsInObject(message.data, ["s"]);
                callback([convertedData]); // Wrap the single Candle in an array
            }
        });
    }

    async subscribeToL2Book(coin: string, callback: (data: WsBook) => void): Promise<void> {
        await this.ensureInitialized();
        const convertedCoin = this.convertSymbol(coin, 'reverse');
        this.subscribe({ type: 'l2Book', coin: convertedCoin });
        this.addSubscription('l2Book', callback);
    }

    async subscribeToTrades(coin: string, callback: (data: WsTrade[]) => void): Promise<void> {
        await this.ensureInitialized();
        const convertedCoin = this.convertSymbol(coin, 'reverse');
        this.subscribe({ type: 'trades', coin: convertedCoin });
        this.addSubscription('trades', callback);
    }

    async subscribeToOrderUpdates(user: string, callback: (data: WsOrder[]) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'orderUpdates', user });
        this.addSubscription('orderUpdates', callback);
    }

    async subscribeToUserEvents(user: string, callback: (data: WsUserEvent) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'userEvents', user });
        this.addSubscription('userEvents', callback);
    }

    async subscribeToUserFills(user: string, callback: (data: WsUserFills) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'userFills', user });
        this.addSubscription('userFills', callback);
    }

    async subscribeToUserFundings(user: string, callback: (data: WsUserFundings) => void): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'userFundings', user });
        this.addSubscription('userFundings', callback);
    }

    async subscribeToUserNonFundingLedgerUpdates(
        user: string,
        callback: (data: WsUserNonFundingLedgerUpdates) => void
    ): Promise<void> {
        await this.ensureInitialized();
        this.subscribe({ type: 'userNonFundingLedgerUpdates', user });
        this.addSubscription('userNonFundingLedgerUpdates', callback);
    }

    async postRequest(requestType: 'info' | 'action', payload: any): Promise<any> {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const id = Date.now();
            const convertedPayload = this.convertSymbolsInObject(payload);
            this.ws.sendMessage({
                method: 'post',
                id,
                request: {
                    type: requestType,
                    payload: convertedPayload,
                },
            });

            const responseHandler = (message: any) => {
                if (message.channel === 'post' && message.data.id === id) {
                    this.ws.removeListener('message', responseHandler);
                    if (message.data.response.type === 'error') {
                        reject(new Error(message.data.response.payload));
                    } else {
                        const convertedResponse = this.convertSymbolsInObject(message.data.response.payload);
                        resolve(convertedResponse);
                    }
                }
            };

            this.ws.on('message', responseHandler);

            setTimeout(() => {
                this.ws.removeListener('message', responseHandler);
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    unsubscribeFromAllMids(callback: (data: AllMids) => void): void {
        this.unsubscribe({ type: 'allMids' });
        this.removeSubscription('allMids', callback);
    }

    unsubscribeFromNotification(user: string, callback: (data: Notification) => void): void {
        this.unsubscribe({ type: 'notification', user });
        this.removeSubscription('notification', callback);
    }

    unsubscribeFromWebData2(user: string, callback: (data: WebData2) => void): void {
        this.unsubscribe({ type: 'webData2', user });
        this.removeSubscription('webData2', callback);
    }

    unsubscribeFromCandle(coin: string, interval: string, callback: (data: Candle[]) => void): void {
        const convertedCoin = this.convertSymbol(coin, 'reverse');
        this.unsubscribe({ type: 'candle', coin: convertedCoin, interval });
        this.removeSubscription('candle', callback);
    }

    unsubscribeFromL2Book(coin: string, callback: (data: WsBook) => void): void {
        const convertedCoin = this.convertSymbol(coin, 'reverse');
        this.unsubscribe({ type: 'l2Book', coin: convertedCoin });
        this.removeSubscription('l2Book', callback);
    }

    unsubscribeFromTrades(coin: string, callback: (data: WsTrade[]) => void): void {
        const convertedCoin = this.convertSymbol(coin, 'reverse');
        this.unsubscribe({ type: 'trades', coin: convertedCoin });
        this.removeSubscription('trades', callback);
    }

    unsubscribeFromOrderUpdates(user: string, callback: (data: WsOrder[]) => void): void {
        this.unsubscribe({ type: 'orderUpdates', user });
        this.removeSubscription('orderUpdates', callback);
    }

    unsubscribeFromUserEvents(user: string, callback: (data: WsUserEvent) => void): void {
        this.unsubscribe({ type: 'userEvents', user });
        this.removeSubscription('userEvents', callback);
    }

    unsubscribeFromUserFills(user: string, callback: (data: WsUserFills) => void): void {
        this.unsubscribe({ type: 'userFills', user });
        this.removeSubscription('userFills', callback);
    }

    unsubscribeFromUserFundings(user: string, callback: (data: WsUserFundings) => void): void {
        this.unsubscribe({ type: 'userFundings', user });
        this.removeSubscription('userFundings', callback);
    }

    unsubscribeFromUserNonFundingLedgerUpdates(
        user: string,
        callback: (data: WsUserNonFundingLedgerUpdates) => void
    ): void {
        this.unsubscribe({ type: 'userNonFundingLedgerUpdates', user });
        this.removeSubscription('userNonFundingLedgerUpdates', callback);
    }
}
