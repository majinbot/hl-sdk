import type { SpotMeta, SpotClearinghouseState, SpotMetaAndAssetCtxs, UserFills } from '../../types';
import { HttpApi } from '../../utils/helpers';
import { INFO_TYPES } from '../../constants';
import { BaseInfoAPI } from './base.ts';
import type { SymbolConverter } from '../../utils/symbolConverter.ts';

export class SpotInfoAPI extends BaseInfoAPI {
    constructor(httpApi: HttpApi, symbolConverter: SymbolConverter) {
        super(httpApi, symbolConverter);
    }

    async getSpotMeta(raw_response: boolean = false): Promise<SpotMeta> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.SPOT_META,
        });
        return raw_response ? response : this.convertSymbolsInObject(response, ['name', 'coin', 'symbol'], 'SPOT');
    }

    async getSpotClearinghouseState(user: string, raw_response: boolean = false): Promise<SpotClearinghouseState> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.SPOT_CLEARINGHOUSE_STATE,
            user,
        });
        return raw_response ? response : this.convertSymbolsInObject(response, ['name', 'coin', 'symbol'], 'SPOT');
    }

    async getSpotMetaAndAssetCtxs(raw_response: boolean = false): Promise<SpotMetaAndAssetCtxs> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.SPOT_META_AND_ASSET_CTXS,
        });
        return raw_response ? response : this.convertSymbolsInObject(response);
    }
}
