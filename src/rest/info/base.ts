import { HttpApi } from '../../utils/helpers';
import { SymbolConverter } from '../../utils/symbolConverter';
import { INFO_TYPES } from '../../constants';

export abstract class BaseInfoAPI {
    protected constructor(protected readonly httpApi: HttpApi, protected readonly symbolConverter: SymbolConverter) {}

    public convertSymbol(symbol: string, mode: string = '', symbolMode: string = ''): string {
        return this.symbolConverter.convertSymbol(symbol, mode, symbolMode);
    }

    public convertSymbolsInObject(
        obj: any,
        symbolsFields: string[] = ['coin', 'symbol'],
        symbolMode: string = ''
    ): any {
        return this.symbolConverter.convertSymbolsInObject(obj, symbolsFields, symbolMode);
    }

    getAssetIndex(assetName: string): number | undefined {
        return this.symbolConverter.getAssetIndex(assetName);
    }

    getInternalName(exchangeName: string): string | undefined {
        return this.symbolConverter.getInternalName(exchangeName);
    }

    getAllAssets(): { perp: string[]; spot: string[] } {
        return this.symbolConverter.getAllAssets();
    }

    async refreshAssetMaps(): Promise<void> {
        try {
            const [perpMetaResponse, spotMetaResponse] = await Promise.all([
                this.httpApi.makeRequest({ type: INFO_TYPES.PERPS_META_AND_ASSET_CTXS }),
                this.httpApi.makeRequest({ type: INFO_TYPES.SPOT_META_AND_ASSET_CTXS }),
            ]);

            const exchangeToInternalNameMap = new Map<string, string>();
            const assetToIndexMap = new Map<string, number>();

            this.processPerpetualAssets(perpMetaResponse, exchangeToInternalNameMap, assetToIndexMap);
            this.processSpotAssets(spotMetaResponse, exchangeToInternalNameMap, assetToIndexMap);

            this.symbolConverter.updateMaps(exchangeToInternalNameMap, assetToIndexMap);

            console.log('Asset maps refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh asset maps:', error);
        }
    }

    private processPerpetualAssets(
        perpMetaResponse: any,
        exchangeToInternalNameMap: Map<string, string>,
        assetToIndexMap: Map<string, number>
    ): void {
        if (Array.isArray(perpMetaResponse) && perpMetaResponse.length > 0 && perpMetaResponse[0].universe) {
            perpMetaResponse[0].universe.forEach((asset: { name: string }, index: number) => {
                const internalName = `${asset.name}-PERP-${index}`;
                const exchangeName = `${asset.name}-${index}`;
                assetToIndexMap.set(internalName, index);
                exchangeToInternalNameMap.set(exchangeName, internalName);
            });
        }
    }

    private processSpotAssets(
        spotMetaResponse: any,
        exchangeToInternalNameMap: Map<string, string>,
        assetToIndexMap: Map<string, number>
    ): void {
        if (Array.isArray(spotMetaResponse) && spotMetaResponse.length > 0 && spotMetaResponse[0].universe) {
            spotMetaResponse[0].universe.forEach((market: { name: string; index: number }) => {
                const baseName = market.name.split('/')[0];
                const internalName = `${baseName}-SPOT-${market.index}`;
                const exchangeName = `${market.name}-${market.index}`;
                assetToIndexMap.set(internalName, 10000 + market.index);
                exchangeToInternalNameMap.set(exchangeName, internalName);
            });
        }
    }
}
