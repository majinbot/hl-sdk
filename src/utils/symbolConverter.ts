export class SymbolConverter {
    private exchangeToInternalNameMap: Map<string, string> = new Map();
    private assetToIndexMap: Map<string, number> = new Map();

    updateMaps(exchangeToInternalNameMap: Map<string, string>, assetToIndexMap: Map<string, number>): void {
        this.exchangeToInternalNameMap = exchangeToInternalNameMap;
        this.assetToIndexMap = assetToIndexMap;
    }

    getAssetIndex(assetName: string): number | undefined {
        return this.assetToIndexMap.get(assetName);
    }

    getInternalName(exchangeName: string): string | undefined {
        return this.exchangeToInternalNameMap.get(exchangeName);
    }

    getAllAssets(): { perp: string[]; spot: string[] } {
        const assets: { perp: string[]; spot: string[] } = { perp: [], spot: [] };
        for (const asset of this.assetToIndexMap.keys()) {
            if (asset.includes('-PERP-')) {
                assets.perp.push(asset);
            } else if (asset.includes('-SPOT-')) {
                assets.spot.push(asset);
            }
        }
        return assets;
    }

    convertSymbol(symbol: string, mode: string = '', symbolMode: string = ''): string {
        if (mode === 'reverse') {
            // Convert from internal to exchange format
            const exchangeSymbol = Array.from(this.exchangeToInternalNameMap.entries()).find(
                ([, value]) => value === symbol
            )?.[0];
            return exchangeSymbol || symbol;
        } else {
            // Convert from exchange to internal format
            let rSymbol = this.exchangeToInternalNameMap.get(symbol);

            if (!rSymbol) {
                // If not found in the map, return the original symbol
                rSymbol = symbol;
            }

            return rSymbol;
        }
    }

    convertSymbolsInObject(obj: any, symbolsFields: string[] = ['coin', 'symbol'], symbolMode: string = ''): any {
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
}
