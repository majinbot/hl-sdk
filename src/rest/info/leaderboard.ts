import type { HttpApi } from '../../utils/helpers.ts';
import type {
    BestTrade,
    ClearinghouseState,
    LeaderboardEntry,
    LeaderboardFilter,
    LeaderboardResponse,
    SpotClearinghouseState,
    TimeWindow,
    TraderPosition,
    UserFill,
    UserFills,
} from '../../types';
import { INFO_TYPES } from '../../constants.ts';
import type { PerpsInfoAPI } from './perps.ts';
import type { SpotInfoAPI } from './spot.ts';
import type { GeneralInfoAPI } from './general.ts';

export class LeaderboardAPI {
    private httpApi: HttpApi;
    private generalInfoAPI: GeneralInfoAPI;
    private perpsInfoAPI: PerpsInfoAPI;
    private spotInfoAPI: SpotInfoAPI;
    private cache: {
        data: LeaderboardResponse | null;
        timestamp: number;
    };

    private readonly cacheExpiryMs: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    constructor(
        httpApi: HttpApi,
        generalInfoAPI: GeneralInfoAPI,
        perpsInfoAPI: PerpsInfoAPI,
        spotInfoAPI: SpotInfoAPI
    ) {
        this.httpApi = httpApi;
        this.generalInfoAPI = generalInfoAPI;
        this.perpsInfoAPI = perpsInfoAPI;
        this.spotInfoAPI = spotInfoAPI;
        this.cache = {
            data: null,
            timestamp: 0,
        };
    }

    private isCacheValid(): boolean {
        return this.cache.data !== null && Date.now() - this.cache.timestamp < this.cacheExpiryMs;
    }

    async getLeaderboard(): Promise<LeaderboardResponse> {
        if (this.isCacheValid()) {
            return this.cache.data!;
        }

        try {
            const leaderboard = await this.httpApi.makeRequest({
                type: INFO_TYPES.LEADERBOARD,
            });

            this.cache = {
                data: leaderboard,
                timestamp: Date.now(),
            };

            return leaderboard;
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            if (this.cache.data) {
                console.warn('Returning potentially outdated cached leaderboard data');
                return this.cache.data;
            }
            throw error;
        }
    }

    async clearCache(): Promise<void> {
        this.cache = {
            data: null,
            timestamp: 0,
        };
    }

    async filterLeaderboard(leaderboard: LeaderboardResponse, filter: LeaderboardFilter): Promise<LeaderboardEntry[]> {
        console.log('Applying initial filters...');
        const initialFilteredEntries = leaderboard.leaderboardRows.filter(entry => {
            const performance = entry.windowPerformances.find(
                ([window]) => window === (filter.timeWindow || 'allTime')
            )?.[1];

            if (!performance) return false;

            const volume = parseFloat(performance.vlm);

            return (
                (!filter.minAccountValue || parseFloat(entry.accountValue) >= filter.minAccountValue) &&
                (!filter.minVolume || volume >= filter.minVolume) &&
                (!filter.maxVolume || volume <= filter.maxVolume) &&
                (!filter.minPnL || parseFloat(performance.pnl) >= filter.minPnL) &&
                (!filter.minRoi || parseFloat(performance.roi) >= filter.minRoi)
            );
        });

        console.log(`Entries after initial filtering: ${initialFilteredEntries.length}`);

        if (filter.maxTrades) {
            console.log('Applying trade count filter...');
            const finalFilteredEntries = [];
            for (const entry of initialFilteredEntries) {
                const tradeCount = await this.getTraderTradeCount(
                    entry.ethAddress,
                    this.getStartTimeForWindow(filter.timeWindow || 'allTime'),
                    Date.now()
                );
                if (tradeCount.total <= filter.maxTrades) {
                    finalFilteredEntries.push({ ...entry, tradeCount });
                }
            }
            console.log(`Entries after trade count filtering: ${finalFilteredEntries.length}`);
            return finalFilteredEntries;
        } else {
            return initialFilteredEntries;
        }
    }

    sortLeaderboard(
        entries: LeaderboardEntry[],
        sortBy: 'pnl' | 'roi' | 'vlm' | 'accountValue',
        timeWindow: TimeWindow = 'allTime'
    ): LeaderboardEntry[] {
        return entries.sort((a, b) => {
            if (sortBy === 'accountValue') {
                return parseFloat(b.accountValue) - parseFloat(a.accountValue);
            }

            const perfA = a.windowPerformances.find(([window]) => window === timeWindow)?.[1];
            const perfB = b.windowPerformances.find(([window]) => window === timeWindow)?.[1];

            if (!perfA || !perfB) return 0;

            return parseFloat(perfB[sortBy]) - parseFloat(perfA[sortBy]);
        });
    }

    async getFilteredAndSortedLeaderboard(
        filter: LeaderboardFilter,
        sortBy: 'pnl' | 'roi' | 'vlm' | 'accountValue' = 'pnl'
    ): Promise<LeaderboardEntry[]> {
        const leaderboard = await this.getLeaderboard();
        const filtered = await this.filterLeaderboard(leaderboard, filter);
        const sorted = this.sortLeaderboard(filtered, sortBy, filter.timeWindow || 'allTime');
        return filter.maxAccounts ? sorted.slice(0, filter.maxAccounts) : sorted;
    }

    async getTraderTradeCount(
        trader: string,
        startTime: number,
        endTime: number
    ): Promise<{ total: number; perp: number; spot: number }> {
        try {
            const fills: UserFills = await this.generalInfoAPI.getUserFillsByTime(trader, startTime, endTime);
            const { perpFills, spotFills } = this.categorizeFills(fills);

            return {
                total: fills.length,
                perp: perpFills.length,
                spot: spotFills.length,
            };
        } catch (error) {
            console.error(`Failed to fetch trade count for trader ${trader}:`, error);
            return { total: 0, perp: 0, spot: 0 };
        }
    }

    private categorizeFills(fills: UserFills): { perpFills: UserFill[]; spotFills: UserFill[] } {
        const perpFills: UserFill[] = [];
        const spotFills: UserFill[] = [];

        fills.forEach(fill => {
            if (this.isPerpFill(fill)) {
                perpFills.push(fill);
            } else {
                spotFills.push(fill);
            }
        });

        return { perpFills, spotFills };
    }

    async getTraderOpenPositions(trader: string): Promise<{ perp: TraderPosition[]; spot: TraderPosition[] }> {
        try {
            const [perpPositions, spotPositions] = await Promise.all([
                this.getPerpPositions(trader),
                this.getSpotPositions(trader),
            ]);

            return { perp: perpPositions, spot: spotPositions };
        } catch (error) {
            console.error(`Failed to fetch open positions for trader ${trader}:`, error);
            return { perp: [], spot: [] };
        }
    }

    private async getPerpPositions(trader: string): Promise<TraderPosition[]> {
        const perpResponse: ClearinghouseState = await this.perpsInfoAPI.getClearinghouseState(trader);
        return perpResponse.assetPositions.map((position: any) => ({
            asset: position.position.coin,
            size: parseFloat(position.position.szi),
            entryPrice: parseFloat(position.position.entryPx),
            leverage: parseFloat(position.position.leverage.value),
            unrealizedPnl: parseFloat(position.position.unrealizedPnl),
            liquidationPrice: parseFloat(position.position.liquidationPx),
        }));
    }

    private async getSpotPositions(trader: string): Promise<TraderPosition[]> {
        const spotResponse: SpotClearinghouseState = await this.spotInfoAPI.getSpotClearinghouseState(trader);
        return spotResponse.balances.map((balance: any) => ({
            asset: balance.coin,
            size: parseFloat(balance.total),
            entryPrice: 0,
            leverage: 1,
            unrealizedPnl: 0,
            liquidationPrice: 0,
        }));
    }

    async getExtendedTraderInfo(trader: LeaderboardEntry, timeWindow: TimeWindow): Promise<any> {
        const startTime = this.getStartTimeForWindow(timeWindow);
        const endTime = Date.now();

        const [tradeCount, openPositions] = await Promise.all([
            this.getTraderTradeCount(trader.ethAddress, startTime, endTime),
            this.getTraderOpenPositions(trader.ethAddress),
        ]);

        return {
            ...trader,
            tradeCount,
            openPositions,
            totalOpenPositions: openPositions.perp.length + openPositions.spot.length,
        };
    }

    public getStartTimeForWindow(timeWindow: TimeWindow): number {
        const now = Date.now();
        switch (timeWindow) {
            case 'day':
                return now - 24 * 60 * 60 * 1000;
            case 'week':
                return now - 7 * 24 * 60 * 60 * 1000;
            case 'month':
                return now - 30 * 24 * 60 * 60 * 1000;
            default:
                return 0; // For 'allTime', return 0 to get all trades
        }
    }

    async getBestTrade(trader: string, timeWindow: TimeWindow): Promise<BestTrade | null> {
        const endTime = Date.now();
        const startTime = this.getStartTimeForWindow(timeWindow);
        let fills;
        try {
            fills = await this.generalInfoAPI.getUserFillsByTime(trader, startTime, endTime);
        } catch (error) {
            console.error(`Failed to fetch user fills for trader ${trader}:`, error);
            return null;
        }

        const bestTrade = fills.reduce<UserFill | null>((best, current) => {
            if (!best || parseFloat(current.closedPnl) > parseFloat(best.closedPnl)) {
                return current;
            }
            return best;
        }, null);

        if (!bestTrade) return null;

        const isPerp = this.isPerpFill(bestTrade);

        let leverage = 1; // Default leverage
        if (isPerp) {
            leverage = this.getLeverageFromFill(bestTrade);
        }

        return {
            ...bestTrade,
            isPerp,
            leverage,
        } as BestTrade;
    }

    private isPerpFill(fill: UserFill): boolean {
        return fill.coin.endsWith('-PERP');
    }

    private getLeverageFromFill(fill: UserFill): number {
        // Attempt to calculate leverage from the fill information
        if (fill.crossed && fill.startPosition && fill.sz) {
            const absStartPosition = Math.abs(parseFloat(fill.startPosition));
            const absSz = Math.abs(parseFloat(fill.sz));
            if (absStartPosition > 0) {
                return Math.round((absStartPosition + absSz) / absStartPosition);
            }
        }
        return 1; // Default leverage if we can't calculate it
    }
}
