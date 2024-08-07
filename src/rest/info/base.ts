import { HttpApi } from '../../utils/helpers';

export abstract class BaseInfoAPI {
    protected httpApi: HttpApi;
    protected exchangeToInternalNameMap: Map<string, string>;
    protected initializationPromise: Promise<void>;

    protected constructor(
        httpApi: HttpApi,
        exchangeToInternalNameMap: Map<string, string>,
        initializationPromise: Promise<void>
    ) {
        this.httpApi = httpApi;
        this.exchangeToInternalNameMap = exchangeToInternalNameMap;
        this.initializationPromise = initializationPromise;
    }

    protected async ensureInitialized(raw_response: boolean): Promise<void> {
        if (!raw_response) {
            await this.initializationPromise;
        }
    }

    protected convertSymbol(symbol: string, mode: string = '', symbolMode: string = ''): string {
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

    protected convertSymbolsInObject(
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

    protected convertToNumber(value: any): any {
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
