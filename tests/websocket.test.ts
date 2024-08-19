import {expect, test, describe, beforeAll, afterAll, beforeEach} from "bun:test";
import { HyperliquidAPI } from "../src";
import type {
    AllMids,
    WsTrade,
    WsBook,
    Candle
} from "../src";

const WS_TIMEOUT = 30_000; // 30 secs

describe("HyperliquidAPI WebSocket", () => {
    let api: HyperliquidAPI;

    beforeAll(async () => {
        api = new HyperliquidAPI();
        await api.ensureInitialized();
    });

    beforeEach(async () => {
        if (!api.ws.isConnected()) {
            await api.connect();
        }
    });

    afterAll(() => {
        api.disconnect();
    });


    test("WebSocket connection can be established", () => {
        expect(api.ws).toBeDefined();
    });

    test("API has loaded assets", () => {
        const assets = api.getAllAssets();
        console.log("Loaded assets", `perps (#${assets.perp.length})`, `spot (#${assets.spot.length})`);
        expect(assets.perp.length).toBeGreaterThan(0);
        expect(assets.spot.length).toBeGreaterThan(0);
    });

    test("Subscribe to allMids", (done) => {
        const timeout = setTimeout(() => {
            console.log("No allMids data received within 5 seconds");
            api.subscriptions.unsubscribeFromAllMids(callback);
            done();
        }, WS_TIMEOUT);

        const callback = (data: AllMids) => {
            clearTimeout(timeout);
            expect(data).toBeDefined();
            expect(Object.keys(data).length).toBeGreaterThan(0);
            api.subscriptions.unsubscribeFromAllMids(callback);
            done();
        };

        try {
            api.subscriptions.subscribeToAllMids(callback);
        } catch (error) {
            clearTimeout(timeout);
            console.error("Error in allMids subscription:", error);
            done(error as Error);
        }
    });

    test("Subscribe to trades", (done) => {
        const assets = api.getAllAssets();
        const symbol = assets.perp[0];
        console.log(`Subscribing to trades for symbol: ${symbol}`);

        const timeout = setTimeout(() => {
            console.log(`No trade data received for ${symbol} within 5 seconds`);
            api.subscriptions.unsubscribeFromTrades(symbol, callback);
            done();
        }, WS_TIMEOUT);

        const callback = (data: WsTrade[]) => {
            clearTimeout(timeout);
            expect(Array.isArray(data)).toBe(true);
            if (data.length > 0) {
                expect(data[0]).toHaveProperty('coin');
                expect(data[0]).toHaveProperty('side');
                expect(data[0]).toHaveProperty('px');
                expect(data[0]).toHaveProperty('sz');
                expect(data[0]).toHaveProperty('time');
            }
            api.subscriptions.unsubscribeFromTrades(symbol, callback);
            done();
        };

        try {
            api.subscriptions.subscribeToTrades(symbol, callback);
        } catch (error) {
            clearTimeout(timeout);
            console.error("Error in trades subscription:", error);
            done(error as Error);
        }
    });

    test("Subscribe to L2 book", (done) => {
        const assets = api.getAllAssets();
        const symbol = assets.perp[0];
        console.log(`Subscribing to L2 book for symbol: ${symbol}`);

        const timeout = setTimeout(() => {
            console.log(`No L2 book data received for ${symbol} within 5 seconds`);
            api.subscriptions.unsubscribeFromL2Book(symbol, callback);
            done();
        }, WS_TIMEOUT);

        const callback = (data: WsBook) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('coin');
            expect(data).toHaveProperty('levels');
            expect(Array.isArray(data.levels)).toBe(true);
            expect(data.levels.length).toBe(2);
            api.subscriptions.unsubscribeFromL2Book(symbol, callback);
            done();
        };

        try {
            api.subscriptions.subscribeToL2Book(symbol, callback);
        } catch (error) {
            clearTimeout(timeout);
            console.error("Error in L2 book subscription:", error);
            done(error as Error);
        }
    });

    test("Subscribe to candles", async () => {
        const assets = api.getAllAssets();
        const symbol = assets.perp[0];
        const interval = '1m';
        console.log(`Subscribing to candles for symbol: ${symbol}, interval: ${interval}`);

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                api.subscriptions.unsubscribeFromCandle(symbol, interval, callback);
                reject(new Error(`No candle data received for ${symbol} within ${WS_TIMEOUT / 1000}s`));
            }, WS_TIMEOUT);

            const callback = (data: Candle[]) => {
                clearTimeout(timeout);
                try {
                    expect(data).toBeDefined();
                    expect(Array.isArray(data)).toBe(true);
                    expect(data.length).toBe(1);

                    const candle = data[0];
                    expect(candle).toHaveProperty('t');
                    expect(candle).toHaveProperty('o');
                    expect(candle).toHaveProperty('h');
                    expect(candle).toHaveProperty('l');
                    expect(candle).toHaveProperty('c');
                    expect(candle).toHaveProperty('v');

                    api.subscriptions.unsubscribeFromCandle(symbol, interval, callback);
                    resolve();
                } catch (error) {
                    api.subscriptions.unsubscribeFromCandle(symbol, interval, callback);
                    reject(error);
                }
            };

            try {
                api.subscriptions.subscribeToCandle(symbol, interval, callback);
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }, WS_TIMEOUT);

    test("Post request", async () => {
        const response = await api.subscriptions.postRequest('info', { type: 'meta' });
        expect(response).toBeDefined();
    });
});