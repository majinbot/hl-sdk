import type {
    Meta,
    MetaAndAssetCtxs,
    ClearinghouseState,
    UserFunding,
    UserNonFundingLedgerUpdates,
    FundingHistory,
} from '../../types';
import { HttpApi } from '../../utils/helpers';
import { INFO_TYPES } from '../../constants';
import { BaseInfoAPI } from './base.ts';

export class PerpsInfoAPI extends BaseInfoAPI {
    constructor(
        httpApi: HttpApi,
        exchangeToInternalNameMap: Map<string, string>,
        initializationPromise: Promise<void>
    ) {
        super(httpApi, exchangeToInternalNameMap, initializationPromise);
    }

    async getMeta(raw_response: boolean = false): Promise<Meta> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest({ type: INFO_TYPES.META });
        return raw_response ? response : this.convertSymbolsInObject(response, ['name', 'coin', 'symbol'], 'PERP');
    }

    async getMetaAndAssetCtxs(raw_response: boolean = false): Promise<MetaAndAssetCtxs> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.PERPS_META_AND_ASSET_CTXS,
        });
        return raw_response ? response : this.convertSymbolsInObject(response, ['name', 'coin', 'symbol'], 'PERP');
    }

    async getClearinghouseState(user: string, raw_response: boolean = false): Promise<ClearinghouseState> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.PERPS_CLEARINGHOUSE_STATE,
            user,
        });
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getUserFunding(
        user: string,
        startTime: number,
        endTime?: number,
        raw_response: boolean = false
    ): Promise<UserFunding> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest(
            {
                type: INFO_TYPES.USER_FUNDING,
                user,
                startTime,
                endTime,
            },
            20
        );
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getUserNonFundingLedgerUpdates(
        user: string,
        startTime: number,
        endTime?: number,
        raw_response: boolean = false
    ): Promise<UserNonFundingLedgerUpdates> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest(
            {
                type: INFO_TYPES.USER_NON_FUNDING_LEDGER_UPDATES,
                user,
                startTime,
                endTime,
            },
            20
        );
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getFundingHistory(
        coin: string,
        startTime: number,
        endTime?: number,
        raw_response: boolean = false
    ): Promise<FundingHistory> {
        await this.ensureInitialized(raw_response);
        const response = await this.httpApi.makeRequest(
            {
                type: INFO_TYPES.FUNDING_HISTORY,
                coin: this.convertSymbol(coin, 'reverse'),
                startTime,
                endTime,
            },
            20
        );
        return raw_response ? response : this.convertSymbolsInObject(response);
    }
}
