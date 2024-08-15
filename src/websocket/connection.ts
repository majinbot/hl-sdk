import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WSS_URLS } from '../constants';

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private pingInterval: Timer | null = null;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number;
    private readonly reconnectDelay: number;
    private readonly pingIntervalMs: number;

    constructor(
        testnet: boolean = false,
        maxReconnectAttempts: number = 5,
        reconnectDelay: number = 5000,
        pingIntervalMs: number = 30000
    ) {
        super();
        this.url = testnet ? WSS_URLS.TESTNET : WSS_URLS.PRODUCTION;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.reconnectDelay = reconnectDelay;
        this.pingIntervalMs = pingIntervalMs;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                this.onOpen();
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                this.onMessage(data);
            });

            this.ws.on('error', (error: Error) => {
                this.onError(error);
                reject(error);
            });

            this.ws.on('close', () => {
                this.onClose();
            });
        });
    }

    private onOpen(): void {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
    }

    private onMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            this.emit('message', message);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    private onError(error: Error): void {
        console.error('WebSocket error:', error);
    }

    private onClose(): void {
        console.log('WebSocket disconnected');
        this.stopPingInterval();
        this.reconnect();
    }

    private reconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached. Please reconnect manually.');
            this.emit('maxReconnectAttemptsReached');
        }
    }

    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            this.sendMessage({ method: 'ping' });
        }, this.pingIntervalMs);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendMessage(message: any): void {
        if (!this.isConnected()) {
            throw new Error('WebSocket is not connected');
        }
        this.ws!.send(JSON.stringify(message));
    }

    close(): void {
        if (this.ws) {
            this.ws.close();
        }
        this.stopPingInterval();
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}
