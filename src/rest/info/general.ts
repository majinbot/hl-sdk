import type {
    AllMids,
    UserOpenOrders,
    FrontendOpenOrders,
    UserFills,
    UserRateLimit,
    OrderStatus,
    L2Book,
    CandleSnapshot,
} from '../../types';
import { HttpApi } from '../../utils/helpers';
import { INFO_TYPES } from '../../constants';
import { BaseInfoAPI } from './base.ts';
import type { SymbolConverter } from '../../utils/symbolConverter.ts';

export class GeneralInfoAPI extends BaseInfoAPI {
    constructor(httpApi: HttpApi, symbolConverter: SymbolConverter) {
        super(httpApi, symbolConverter);
    }

    async getAllMids(raw_response: boolean = false): Promise<AllMids> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.ALL_MIDS,
        });
        return raw_response ? response : this.convertAllMids(response);
    }

    async getUserOpenOrders(user: string, raw_response: boolean = false): Promise<UserOpenOrders> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.OPEN_ORDERS,
            user,
        });
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getFrontendOpenOrders(user: string, raw_response: boolean = false): Promise<FrontendOpenOrders> {
        const response = await this.httpApi.makeRequest({ type: INFO_TYPES.FRONTEND_OPEN_ORDERS, user }, 20);
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getUserFills(user: string, raw_response: boolean = false): Promise<UserFills> {
        const response = await this.httpApi.makeRequest({ type: INFO_TYPES.USER_FILLS, user }, 20);
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getUserFillsByTime(
        user: string,
        startTime: number,
        endTime?: number,
        raw_response: boolean = false
    ): Promise<UserFills> {
        const params: {
            user: string;
            startTime: number;
            type: typeof INFO_TYPES.USER_FILLS_BY_TIME;
            endTime?: number;
        } = {
            user,
            startTime: Math.round(startTime),
            type: INFO_TYPES.USER_FILLS_BY_TIME,
        };

        if (endTime !== undefined) {
            params.endTime = Math.round(endTime);
        }

        const response = await this.httpApi.makeRequest(params, 20);
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getTradeInfo(user: string, orderId: number): Promise<any> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.TRADE_INFO,
            user,
            orderId,
        });
        return this.convertSymbolsInObject(response);
    }

    async getUserRateLimit(user: string, raw_response: boolean = false): Promise<UserRateLimit> {
        const response = await this.httpApi.makeRequest({ type: INFO_TYPES.USER_RATE_LIMIT, user }, 20);
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getOrderStatus(user: string, oid: number | string, raw_response: boolean = false): Promise<OrderStatus> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.ORDER_STATUS,
            user,
            oid,
        });
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getL2Book(coin: string, raw_response: boolean = false): Promise<L2Book> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.L2_BOOK,
            coin: this.convertSymbol(coin, 'reverse'),
        });
        return raw_response ? response : this.convertSymbolsInObject(response);
    }

    async getCandleSnapshot(
        coin: string,
        interval: string,
        startTime: number,
        endTime: number,
        raw_response: boolean = false
    ): Promise<CandleSnapshot> {
        const response = await this.httpApi.makeRequest({
            type: INFO_TYPES.CANDLE_SNAPSHOT,
            req: {
                coin: this.convertSymbol(coin, 'reverse'),
                interval,
                startTime,
                endTime,
            },
        });
        return raw_response ? response : this.convertSymbolsInObject(response, ['s']);
    }

    private convertAllMids(response: any): AllMids {
        const convertedResponse: AllMids = {};
        for (const [key, value] of Object.entries(response)) {
            const convertedKey = this.convertSymbol(key);
            const convertedValue = parseFloat(value as string);
            convertedResponse[convertedKey] = String(convertedValue);
        }
        return convertedResponse;
    }
}
