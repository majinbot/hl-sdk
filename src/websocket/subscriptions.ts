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
} from '../types';

type SubscriptionType =
    | 'allMids'
    | 'notification'
    | 'webData2'
    | 'candle'
    | 'l2Book'
    | 'trades'
    | 'orderUpdates'
    | 'userEvents'
    | 'userFills'
    | 'userFundings'
    | 'userNonFundingLedgerUpdates';

interface SubscriptionMessage {
    method: 'subscribe' | 'unsubscribe';
    subscription: {
        type: SubscriptionType;
        [key: string]: any;
    };
}

export class WebSocketSubscriptions {
    private ws: WebSocketClient;
    private subscriptions: Map<string, Set<(data: any) => void>> = new Map();

    constructor(ws: WebSocketClient) {
        this.ws = ws;
        this.ws.on('message', this.handleMessage.bind(this));
    }

    private subscribe(subscription: SubscriptionMessage['subscription']): void {
        this.ws.sendMessage({ method: 'subscribe', subscription });
    }

    private unsubscribe(subscription: SubscriptionMessage['subscription']): void {
        this.ws.sendMessage({ method: 'unsubscribe', subscription });
    }

    private handleMessage(message: any): void {
        const { channel, data } = message;
        if (this.subscriptions.has(channel)) {
            this.subscriptions.get(channel)?.forEach(callback => callback(data));
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

    subscribeToAllMids(callback: (data: AllMids) => void): void {
        this.subscribe({ type: 'allMids' });
        this.addSubscription('allMids', callback);
    }

    subscribeToNotification(user: string, callback: (data: Notification) => void): void {
        this.subscribe({ type: 'notification', user });
        this.addSubscription('notification', callback);
    }

    subscribeToWebData2(user: string, callback: (data: WebData2) => void): void {
        this.subscribe({ type: 'webData2', user });
        this.addSubscription('webData2', callback);
    }

    subscribeToCandle(coin: string, interval: string, callback: (data: Candle[]) => void): void {
        this.subscribe({ type: 'candle', coin, interval });
        this.addSubscription('candle', callback);
    }

    subscribeToL2Book(coin: string, callback: (data: WsBook) => void): void {
        this.subscribe({ type: 'l2Book', coin });
        this.addSubscription('l2Book', callback);
    }

    subscribeToTrades(coin: string, callback: (data: WsTrade[]) => void): void {
        this.subscribe({ type: 'trades', coin });
        this.addSubscription('trades', callback);
    }

    subscribeToOrderUpdates(user: string, callback: (data: WsOrder[]) => void): void {
        this.subscribe({ type: 'orderUpdates', user });
        this.addSubscription('orderUpdates', callback);
    }

    subscribeToUserEvents(user: string, callback: (data: WsUserEvent) => void): void {
        this.subscribe({ type: 'userEvents', user });
        this.addSubscription('userEvents', callback);
    }

    subscribeToUserFills(user: string, callback: (data: WsUserFills) => void): void {
        this.subscribe({ type: 'userFills', user });
        this.addSubscription('userFills', callback);
    }

    subscribeToUserFundings(user: string, callback: (data: WsUserFundings) => void): void {
        this.subscribe({ type: 'userFundings', user });
        this.addSubscription('userFundings', callback);
    }

    subscribeToUserNonFundingLedgerUpdates(
        user: string,
        callback: (data: WsUserNonFundingLedgerUpdates) => void
    ): void {
        this.subscribe({ type: 'userNonFundingLedgerUpdates', user });
        this.addSubscription('userNonFundingLedgerUpdates', callback);
    }

    postRequest(requestType: 'info' | 'action', payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = Date.now();
            this.ws.sendMessage({
                method: 'post',
                id,
                request: {
                    type: requestType,
                    payload,
                },
            });

            const responseHandler = (message: any) => {
                if (message.channel === 'post' && message.data.id === id) {
                    this.ws.removeListener('message', responseHandler);
                    if (message.data.response.type === 'error') {
                        reject(new Error(message.data.response.payload));
                    } else {
                        resolve(message.data.response.payload);
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
        this.unsubscribe({ type: 'candle', coin, interval });
        this.removeSubscription('candle', callback);
    }

    unsubscribeFromL2Book(coin: string, callback: (data: WsBook) => void): void {
        this.unsubscribe({ type: 'l2Book', coin });
        this.removeSubscription('l2Book', callback);
    }

    unsubscribeFromTrades(coin: string, callback: (data: WsTrade[]) => void): void {
        this.unsubscribe({ type: 'trades', coin });
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
