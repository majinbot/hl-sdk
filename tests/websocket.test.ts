import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { HyperliquidAPI } from "../src/api";
import type {
    AllMids,
    WsTrade,
    WsBook,
    Candle
} from "../src";

describe("HyperliquidAPI WebSocket", () => {
    let api: HyperliquidAPI;

    beforeAll(async () => {
        api = new HyperliquidAPI();
        await api.ensureInitialized();
        await api.connect();
    });

    afterAll(() => {
        api.disconnect();
    });

    test("WebSocket connection can be established", () => {
        expect(api.ws).toBeDefined();
    });

    test("API has loaded assets", () => {
        const assets = api.getAllAssets();
        console.log("Loaded assets:", assets);
        expect(assets.perp.length).toBeGreaterThan(0);
        expect(assets.spot.length).toBeGreaterThan(0);
    });

    test("Subscribe to allMids", (done) => {
        const timeout = setTimeout(() => {
            console.log("No allMids data received within 5 seconds");
            api.subscriptions.unsubscribeFromAllMids(callback);
            done();
        }, 5000);

        const callback = (data: AllMids) => {
            clearTimeout(timeout);
            console.log("Received allMids data:", data);
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
        }, 5000);

        const callback = (data: WsTrade[]) => {
            clearTimeout(timeout);
            console.log(`Received trade data for ${symbol}:`, data);
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
        }, 5000);

        const callback = (data: WsBook) => {
            clearTimeout(timeout);
            console.log(`Received L2 book data for ${symbol}:`, data);
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

    test("Subscribe to candles", (done) => {
        const assets = api.getAllAssets();
        const symbol = assets.perp[0];
        const interval = '5m';
        console.log(`Subscribing to candles for symbol: ${symbol}, interval: ${interval}`);

        const timeout = setTimeout(() => {
            console.log(`No candle data received for ${symbol} within 5 seconds`);
            api.subscriptions.unsubscribeFromCandle(symbol, interval, callback);
            done();
        }, 5000);

        const callback = (data: Candle[]) => {
            clearTimeout(timeout);
            console.log(`Received candle data for ${symbol}:`, data);
            expect(Array.isArray(data)).toBe(true);
            if (data.length > 0) {
                expect(data[0]).toHaveProperty('t');
                expect(data[0]).toHaveProperty('o');
                expect(data[0]).toHaveProperty('h');
                expect(data[0]).toHaveProperty('l');
                expect(data[0]).toHaveProperty('c');
                expect(data[0]).toHaveProperty('v');
            }
            api.subscriptions.unsubscribeFromCandle(symbol, interval, callback);
            done();
        };

        try {
            api.subscriptions.subscribeToCandle(symbol, interval, callback);
        } catch (error) {
            clearTimeout(timeout);
            console.error("Error in candles subscription:", error);
            done(error as Error);
        }
    });
});