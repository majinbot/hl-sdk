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
    private isReconnecting: boolean = false;
    private messageQueue: any[] = [];
    private connectionPromise: Promise<void> | null = null;

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

    async connect(): Promise<void> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                this.onOpen().catch(error => {
                    console.error('Error during onOpen:', error);
                    reject(error);
                });
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

        return this.connectionPromise;
    }

    private async onOpen(): Promise<void> {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.startPingInterval();
        this.emit('open');
        await this.flushMessageQueue();
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
        this.emit('error', error);
    }

    private onClose(): void {
        console.log('WebSocket disconnected');
        this.stopPingInterval();
        this.connectionPromise = null;
        this.emit('close');
        if (!this.isReconnecting) {
            this.reconnect().catch(error => {
                console.error('Reconnection failed:', error);
                this.emit('reconnectFailed', error);
            });
        }
    }

    private async reconnect(): Promise<void> {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        while (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            try {
                await this.connect();
                return;
            } catch (error) {
                console.error('Reconnection attempt failed:', error);
                await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
            }
        }

        this.isReconnecting = false;
        console.error('Max reconnection attempts reached. Please reconnect manually.');
        this.emit('maxReconnectAttemptsReached');
        throw new Error('Max reconnection attempts reached');
    }

    public async ensureConnected(): Promise<void> {
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                console.error('Failed to ensure connection:', error);
                throw error;
            }
        }
    }

    private startPingInterval(): void {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            this.sendMessage({ method: 'ping' }).catch(error => {
                console.error('Failed to send ping:', error);
            });
        }, this.pingIntervalMs);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    async sendMessage(message: any): Promise<void> {
        await this.ensureConnected();
        if (this.isConnected()) {
            this.ws!.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    private async flushMessageQueue(): Promise<void> {
        const promises: Promise<void>[] = [];
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            promises.push(this.sendMessage(message));
        }
        await Promise.all(promises);
    }

    close(): void {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connectionPromise = null;
        this.isReconnecting = false;
        this.messageQueue = [];
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}
