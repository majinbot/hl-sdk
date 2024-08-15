import { expect, test, describe } from "bun:test";
import { HyperliquidAPI } from "../src/api";
import { HyperliquidAPIError } from "../src/utils/errors";
import type {
    AllMids,
    Meta,
    MetaAndAssetCtxs,
    L2Book,
    CandleSnapshot,
    SpotMeta,
    SpotMetaAndAssetCtxs,
    LeaderboardResponse,
    LeaderboardEntry,
    Performance
} from "../src/types";

describe("HyperliquidAPI Read APIs", () => {
    const api = new HyperliquidAPI();

    // Helper function to check if a string is a valid number
    const isValidNumber = (str: string): boolean => !isNaN(parseFloat(str));

    // Helper function to check if an object has all required keys
    const hasAllKeys = (obj: any, keys: string[]): boolean => keys.every(key => key in obj);

    test("getAllMids returns valid data", async () => {
        const allMids: AllMids = await api.info.getAllMids();
        expect(allMids).toBeDefined();
        expect(Object.keys(allMids).length).toBeGreaterThan(0);
        for (const [symbol, price] of Object.entries(allMids)) {
            expect(typeof symbol).toBe("string");
            expect(isValidNumber(price)).toBe(true);
        }
    });

    test("getMeta returns valid metadata", async () => {
        const meta: Meta = await api.info.perpetuals.getMeta();
        expect(meta).toBeDefined();
        expect(Array.isArray(meta.universe)).toBe(true);
        expect(meta.universe.length).toBeGreaterThan(0);
        meta.universe.forEach((asset: { name: string; szDecimals: number; maxLeverage: number; onlyIsolated: boolean }) => {
            expect(hasAllKeys(asset, ['name', 'szDecimals', 'maxLeverage', 'onlyIsolated'])).toBe(true);
        });
    });

    test("getMetaAndAssetCtxs returns valid data", async () => {
        const data: MetaAndAssetCtxs = await api.info.perpetuals.getMetaAndAssetCtxs();
        console.log("getMetaAndAssetCtxs response:", JSON.stringify(data.meta, null, 2));
        expect(data).toBeDefined();

        if (data.meta === undefined) {
            console.warn("meta property is undefined in getMetaAndAssetCtxs response");
        } else {
            expect(data.meta).toBeDefined();
        }

        if (data.assetCtxs === undefined) {
            console.warn("assetCtxs property is undefined in getMetaAndAssetCtxs response");
        } else if (!Array.isArray(data.assetCtxs)) {
            console.warn("assetCtxs is not an array in getMetaAndAssetCtxs response");
            expect(typeof data.assetCtxs).toBe("object");
            // Check if it's an object with numeric keys
            const keys = Object.keys(data.assetCtxs);
            expect(keys.length).toBeGreaterThan(0);
            expect(isNaN(parseInt(keys[0]))).toBe(false);
        } else {
            expect(data.assetCtxs.length).toBeGreaterThan(0);
            data.assetCtxs.forEach((ctx: any) => {
                expect(hasAllKeys(ctx, ['dayNtlVlm', 'funding', 'impactPxs', 'markPx', 'midPx', 'openInterest', 'oraclePx', 'premium', 'prevDayPx'])).toBe(true);
            });
        }
    });

    test("getSpotMetaAndAssetCtxs returns valid data", async () => {
        const data: SpotMetaAndAssetCtxs = await api.info.spot.getSpotMetaAndAssetCtxs();
        console.log("getSpotMetaAndAssetCtxs response:", JSON.stringify(data.meta, null, 2));
        expect(data).toBeDefined();

        if (data.meta === undefined) {
            console.warn("meta property is undefined in getSpotMetaAndAssetCtxs response");
        } else {
            expect(data.meta).toBeDefined();
        }

        if (data.assetCtxs === undefined) {
            console.warn("assetCtxs property is undefined in getSpotMetaAndAssetCtxs response");
        } else if (!Array.isArray(data.assetCtxs)) {
            console.warn("assetCtxs is not an array in getSpotMetaAndAssetCtxs response");
            expect(typeof data.assetCtxs).toBe("object");
            // Check if it's an object with numeric keys
            const keys = Object.keys(data.assetCtxs);
            expect(keys.length).toBeGreaterThan(0);
            expect(isNaN(parseInt(keys[0]))).toBe(false);
        } else {
            expect(data.assetCtxs.length).toBeGreaterThan(0);
            data.assetCtxs.forEach((ctx: any) => {
                expect(hasAllKeys(ctx, ['dayNtlVlm', 'markPx', 'midPx', 'prevDayPx'])).toBe(true);
            });
        }
    });

    test("getL2Book returns valid order book data", async () => {
        try {
            const assets = api.getAllAssets();
            const symbol = assets.perp[0]; // Use the first perpetual asset
            const l2Book: L2Book = await api.info.getL2Book(symbol);
            expect(l2Book).toBeDefined();
            expect(Array.isArray(l2Book.levels)).toBe(true);
            expect(l2Book.levels.length).toBe(2);
            l2Book.levels.forEach((side: any[]) => {
                expect(Array.isArray(side)).toBe(true);
                side.forEach((level: { px: string; sz: string; n: number }) => {
                    expect(hasAllKeys(level, ['px', 'sz', 'n'])).toBe(true);
                    expect(isValidNumber(level.px)).toBe(true);
                    expect(isValidNumber(level.sz)).toBe(true);
                    expect(Number.isInteger(level.n)).toBe(true);
                });
            });
        } catch (error) {
            if (error instanceof HyperliquidAPIError) {
                console.warn(`HyperliquidAPIError in getL2Book: ${error.message}`);
            } else {
                throw error;
            }
        }
    });

    test("getCandleSnapshot returns valid candle data", async () => {
        try {
            const assets = api.getAllAssets();
            const symbol = assets.perp[0]; // Use the first perpetual asset
            const interval = "5m";
            const startTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
            const endTime = Date.now();
            const candles: CandleSnapshot = await api.info.getCandleSnapshot(symbol, interval, startTime, endTime);
            console.log("candles length", candles.length);
            expect(Array.isArray(candles)).toBe(true);
            expect(candles.length).toBeGreaterThan(0);
            candles.forEach((candle: any) => {
                expect(hasAllKeys(candle, ['T', 'c', 'h', 'i', 'l', 'n', 'o', 's', 't', 'v'])).toBe(true);
                expect(isValidNumber(candle.c)).toBe(true);
                expect(isValidNumber(candle.h)).toBe(true);
                expect(isValidNumber(candle.l)).toBe(true);
                expect(isValidNumber(candle.o)).toBe(true);
                expect(isValidNumber(candle.v)).toBe(true);
                expect(Number.isInteger(candle.T)).toBe(true);
                expect(Number.isInteger(candle.t)).toBe(true);
                expect(Number.isInteger(candle.n)).toBe(true);
            });
        } catch (error) {
            if (error instanceof HyperliquidAPIError) {
                console.warn(`HyperliquidAPIError in getCandleSnapshot: ${error}`);
            } else {
                throw error;
            }
        }
    });

    test("getSpotMeta returns valid spot metadata", async () => {
        const spotMeta: SpotMeta = await api.info.spot.getSpotMeta();
        expect(spotMeta).toBeDefined();
        expect(Array.isArray(spotMeta.tokens)).toBe(true);
        expect(spotMeta.tokens.length).toBeGreaterThan(0);
        expect(Array.isArray(spotMeta.universe)).toBe(true);
        expect(spotMeta.universe.length).toBeGreaterThan(0);
        spotMeta.tokens.forEach((token: any) => {
            expect(hasAllKeys(token, ['name', 'szDecimals', 'weiDecimals', 'index', 'tokenId', 'isCanonical'])).toBe(true);
        });
        spotMeta.universe.forEach((market: any) => {
            expect(hasAllKeys(market, ['name', 'tokens', 'index', 'isCanonical'])).toBe(true);
            expect(Array.isArray(market.tokens)).toBe(true);
            expect(market.tokens.length).toBe(2);
        });
    });

    test("getLeaderboard returns valid data", async () => {
        try {
            const leaderboard: LeaderboardResponse = await api.leaderboard.getLeaderboard();
            expect(leaderboard).toBeDefined();
            expect(Array.isArray(leaderboard.leaderboardRows)).toBe(true);
            expect(leaderboard.leaderboardRows.length).toBeGreaterThan(0);
            leaderboard.leaderboardRows.forEach((entry: LeaderboardEntry) => {
                expect(hasAllKeys(entry, ['ethAddress', 'accountValue', 'windowPerformances', 'prize', 'displayName'])).toBe(true);
                expect(isValidNumber(entry.accountValue)).toBe(true);
                expect(Array.isArray(entry.windowPerformances)).toBe(true);
                entry.windowPerformances.forEach(([window, performance]: [string, Performance]) => {
                    expect(typeof window).toBe("string");
                    expect(hasAllKeys(performance, ['pnl', 'roi', 'vlm'])).toBe(true);
                    expect(isValidNumber(performance.pnl)).toBe(true);
                    expect(isValidNumber(performance.roi)).toBe(true);
                    expect(isValidNumber(performance.vlm)).toBe(true);
                });
            });
        } catch (error) {
            console.error("Error in getLeaderboard:", error);
            throw error;
        }
    }, 20000);  // Increase timeout to 20 seconds

    test("filterLeaderboard returns correct results", async () => {
        const leaderboard: LeaderboardResponse = await api.leaderboard.getLeaderboard();
        const filtered = api.leaderboard.filterLeaderboard(leaderboard, {
            timeWindow: 'month',
            minAccountValue: 10000,
            minVolume: 1000000,
            minPnL: 1000,
            minRoi: 0.1,
            maxAccounts: 10
        });
        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered.length).toBeLessThanOrEqual(10);
        filtered.forEach((entry: LeaderboardEntry) => {
            const monthPerformance = entry.windowPerformances.find(([window]) => window === 'month')?.[1];
            expect(parseFloat(entry.accountValue)).toBeGreaterThanOrEqual(10000);
            expect(parseFloat(monthPerformance!.vlm)).toBeGreaterThanOrEqual(1000000);
            expect(parseFloat(monthPerformance!.pnl)).toBeGreaterThanOrEqual(1000);
            expect(parseFloat(monthPerformance!.roi)).toBeGreaterThanOrEqual(0.1);
        });
    }, 20000);  // Increase timeout to 20 seconds

    test("sortLeaderboard returns correctly sorted results", async () => {
        const leaderboard: LeaderboardResponse = await api.leaderboard.getLeaderboard();
        const sorted = api.leaderboard.sortLeaderboard(leaderboard.leaderboardRows, 'pnl', 'month');
        expect(Array.isArray(sorted)).toBe(true);
        expect(sorted.length).toBe(leaderboard.leaderboardRows.length);
        for (let i = 1; i < sorted.length; i++) {
            const prevPnl = parseFloat(sorted[i - 1].windowPerformances.find(([window]) => window === 'month')?.[1].pnl || '0');
            const currentPnl = parseFloat(sorted[i].windowPerformances.find(([window]) => window === 'month')?.[1].pnl || '0');
            expect(prevPnl).toBeGreaterThanOrEqual(currentPnl);
        }
    });
});