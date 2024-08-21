import { expect, test, describe, beforeAll } from "bun:test";
import { BaseInfoAPI } from "../src/rest/info/base";
import { BASE_URLS, ENDPOINTS, HttpApi, RateLimiter } from "../src";
import { SymbolConverter } from "../src/utils/symbolConverter";

class TestBaseInfoAPI extends BaseInfoAPI {
    constructor(httpApi: HttpApi, symbolConverter: SymbolConverter) {
        super(httpApi, symbolConverter);
    }

    public getSymbolConverterMaps() {
        return {
            exchangeToInternalNameMap: this['symbolConverter']['exchangeToInternalNameMap'],
            assetToIndexMap: this['symbolConverter']['assetToIndexMap']
        };
    }
}

describe("BaseInfoAPI", () => {
    let baseInfoAPI: TestBaseInfoAPI;
    let allAssets: { perp: string[], spot: string[] };
    let exchangeToInternalNameMap: Map<string, string>;
    let assetToIndexMap: Map<string, number>;

    beforeAll(async () => {
        const rateLimiter = new RateLimiter();
        const httpApi = new HttpApi(BASE_URLS.MAINNET, ENDPOINTS.INFO, rateLimiter);
        const symbolConverter = new SymbolConverter();
        baseInfoAPI = new TestBaseInfoAPI(httpApi, symbolConverter);

        await baseInfoAPI.refreshAssetMaps();
        allAssets = baseInfoAPI.getAllAssets();
        console.log("First 5 perpetual assets:", allAssets.perp.slice(0, 5));
        console.log("First 5 spot assets:", allAssets.spot.slice(0, 5));

        ({ exchangeToInternalNameMap, assetToIndexMap } = baseInfoAPI.getSymbolConverterMaps());
        console.log("First 5 entries of Exchange to Internal Name Map:",
            Object.fromEntries(Array.from(exchangeToInternalNameMap).slice(0, 5)));
        console.log("First 5 entries of Asset to Index Map:",
            Object.fromEntries(Array.from(assetToIndexMap).slice(0, 5)));
    });

    test("perpetual asset conversion", () => {
        const btcSymbol = allAssets.perp[0]; // Assuming BTC is the first perpetual asset
        const btcExchangeSymbol = btcSymbol.replace("-PERP-", "-");

        console.log(`Testing BTC conversion:`);
        console.log(`Internal to Exchange: ${baseInfoAPI.convertSymbol(btcSymbol, 'reverse')}`);
        console.log(`Exchange to Internal: ${baseInfoAPI.convertSymbol(btcExchangeSymbol)}`);

        expect(baseInfoAPI.convertSymbol(btcSymbol, 'reverse')).toBe(btcExchangeSymbol);
        expect(baseInfoAPI.convertSymbol(btcExchangeSymbol)).toBe(btcSymbol);
        expect(baseInfoAPI.getInternalName(btcExchangeSymbol)).toBe(btcSymbol);
        expect(baseInfoAPI.getAssetIndex(btcSymbol)).toBeDefined();
    });

    test("spot asset conversion", () => {
        const purrSymbol = allAssets.spot[0]; // Assuming PURR is the first spot asset
        const purrExchangeSymbol = purrSymbol.replace("-SPOT-", "/USDC-");

        console.log(`Testing PURR conversion:`);
        console.log(`Internal to Exchange: ${baseInfoAPI.convertSymbol(purrSymbol, 'reverse')}`);
        console.log(`Exchange to Internal: ${baseInfoAPI.convertSymbol(purrExchangeSymbol)}`);

        expect(baseInfoAPI.convertSymbol(purrSymbol, 'reverse')).toBe(purrExchangeSymbol);
        expect(baseInfoAPI.convertSymbol(purrExchangeSymbol)).toBe(purrSymbol);
        expect(baseInfoAPI.getInternalName(purrExchangeSymbol)).toBe(purrSymbol);
        expect(baseInfoAPI.getAssetIndex(purrSymbol)).toBeDefined();
    });

    test("object symbol conversion", () => {
        const btcExchangeSymbol = allAssets.perp[0].replace("-PERP-", "-");
        const testObject = { coin: btcExchangeSymbol };
        const convertedObject = baseInfoAPI.convertSymbolsInObject(testObject);
        console.log(`Converted Object: ${JSON.stringify(convertedObject)}`);
        expect(convertedObject.coin).toBe(allAssets.perp[0]);
    });

    test("unknown symbol handling", () => {
        console.log("Testing unknown symbol conversion:");
        const unknownSymbols = ["UNKNOWN-0", "RANDOM-SYMBOL", "TEST/USDC-5", "NEW-1000"];

        unknownSymbols.forEach(symbol => {
            console.log(`Converting symbol: ${symbol}`);
            const result = baseInfoAPI.convertSymbol(symbol);
            console.log(`Conversion result: ${result}`);
            expect(result).toBe(symbol);
        });

        unknownSymbols.forEach(symbol => {
            expect(baseInfoAPI.getInternalName(symbol)).toBeUndefined();
            expect(baseInfoAPI.getAssetIndex(symbol)).toBeUndefined();
        });
    });

    test("handling of duplicate names", () => {
        // Find two spot assets with the same base name, if any
        const spotAssetGroups = allAssets.spot.reduce((acc, asset) => {
            const baseName = asset.split('-')[0];
            acc[baseName] = acc[baseName] || [];
            acc[baseName].push(asset);
            return acc;
        }, {} as Record<string, string[]>);

        const duplicateGroup = Object.values(spotAssetGroups).find(group => group.length > 1);

        if (duplicateGroup) {
            const [asset1, asset2] = duplicateGroup;
            const exchangeSymbol1 = asset1.replace("-SPOT-", "/USDC-");
            const exchangeSymbol2 = asset2.replace("-SPOT-", "/USDC-");

            console.log(`Testing duplicate spot assets: ${asset1}, ${asset2}`);
            console.log(`Exchange symbols: ${exchangeSymbol1}, ${exchangeSymbol2}`);

            expect(baseInfoAPI.convertSymbol(exchangeSymbol1)).toBe(asset1);
            expect(baseInfoAPI.convertSymbol(exchangeSymbol2)).toBe(asset2);
            expect(baseInfoAPI.convertSymbol(asset1, 'reverse')).toBe(exchangeSymbol1);
            expect(baseInfoAPI.convertSymbol(asset2, 'reverse')).toBe(exchangeSymbol2);
        } else {
            console.log("No duplicate spot assets found in the current data");
        }
    });

    test("asset index retrieval", () => {
        allAssets.perp.slice(0, 5).forEach(asset => {
            const index = baseInfoAPI.getAssetIndex(asset);
            console.log(`Asset: ${asset}, Index: ${index}`);
            expect(index).toBeDefined();
            expect(typeof index).toBe('number');
        });

        allAssets.spot.slice(0, 5).forEach(asset => {
            const index = baseInfoAPI.getAssetIndex(asset);
            console.log(`Asset: ${asset}, Index: ${index}`);
            expect(index).toBeDefined();
            expect(typeof index).toBe('number');
            expect(index).toBeGreaterThanOrEqual(10000);
        });
    });
});