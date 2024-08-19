import type { HttpApi } from '../../utils/helpers.ts';
import type { LeaderboardEntry, LeaderboardFilter, LeaderboardResponse, TimeWindow, TraderPosition } from '../../types';
import { INFO_TYPES } from '../../constants.ts';

export class LeaderboardAPI {
    private httpApi: HttpApi;
    private cache: {
        data: LeaderboardResponse | null;
        timestamp: number;
    };

    private readonly cacheExpiryMs: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    constructor(httpApi: HttpApi) {
        this.httpApi = httpApi;
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
                if (tradeCount <= filter.maxTrades) {
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

    async getTraderTradeCount(trader: string, startTime: number, endTime: number): Promise<number> {
        try {
            const response = await this.httpApi.makeRequest({
                type: INFO_TYPES.USER_FILLS_BY_TIME,
                user: trader,
                startTime,
                endTime,
            });
            return response.length;
        } catch (error) {
            console.error(`Failed to fetch trade count for trader ${trader}:`, error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            // Return a default value instead of null
            return 0;
        }
    }

    async getTraderOpenPositions(trader: string): Promise<{ perp: TraderPosition[]; spot: TraderPosition[] }> {
        const perpPositions: TraderPosition[] = [];
        const spotPositions: TraderPosition[] = [];

        try {
            const perpResponse = await this.httpApi.makeRequest({
                type: INFO_TYPES.PERPS_CLEARINGHOUSE_STATE,
                user: trader,
            });

            perpPositions.push(
                ...perpResponse.assetPositions.map((position: any) => ({
                    asset: position.position.coin,
                    size: parseFloat(position.position.szi),
                    entryPrice: parseFloat(position.position.entryPx),
                    leverage: parseFloat(position.position.leverage.value),
                    unrealizedPnl: parseFloat(position.position.unrealizedPnl),
                    liquidationPrice: parseFloat(position.position.liquidationPx),
                }))
            );

            const spotResponse = await this.httpApi.makeRequest({
                type: INFO_TYPES.SPOT_CLEARINGHOUSE_STATE,
                user: trader,
            });

            spotPositions.push(
                ...spotResponse.balances.map((balance: any) => ({
                    asset: balance.coin,
                    size: parseFloat(balance.total),
                    entryPrice: null,
                    leverage: 1,
                    unrealizedPnl: null,
                    liquidationPrice: null,
                }))
            );
        } catch (error) {
            console.error(`Failed to fetch open positions for trader ${trader}:`, error);
        }

        return { perp: perpPositions, spot: spotPositions };
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

    private getStartTimeForWindow(timeWindow: TimeWindow): number {
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

    async analyzeTradersData(
        filter: LeaderboardFilter,
        sortBy: 'pnl' | 'roi' | 'vlm' | 'accountValue' = 'pnl'
    ): Promise<any> {
        const topTraders = await this.getFilteredAndSortedLeaderboard(filter, sortBy);
        const top3Traders = topTraders.slice(0, 3);

        console.log('TOP 3 TRADERS:', top3Traders);

        const extendedTraderInfo = await Promise.all(
            top3Traders.map(trader => this.getExtendedTraderInfo(trader, filter.timeWindow || 'allTime'))
        );

        return {
            topTraders: extendedTraderInfo,
            analysis: {
                sharedAssets: this.findSharedAssets(extendedTraderInfo.map(info => info.openPositions)),
                overallSentiment: this.calculateOverallSentiment(extendedTraderInfo.map(info => info.openPositions)),
                riskAnalysis: this.analyzeRisk(extendedTraderInfo.map(info => info.openPositions)),
                tradingActivity: this.analyzeTradingActivity(extendedTraderInfo),
            },
        };
    }

    private findSharedAssets(positions: Array<{ perp: TraderPosition[]; spot: TraderPosition[] }>): string[] {
        const assetCounts: Record<string, number> = {};
        positions.forEach(traderPositions => {
            [...traderPositions.perp, ...traderPositions.spot].forEach(position => {
                assetCounts[position.asset] = (assetCounts[position.asset] || 0) + 1;
            });
        });
        return Object.entries(assetCounts)
            .filter(([_, count]) => count > 1)
            .map(([asset, _]) => asset);
    }

    private calculateOverallSentiment(
        positions: Array<{ perp: TraderPosition[]; spot: TraderPosition[] }>
    ): 'bullish' | 'bearish' | 'neutral' {
        let totalSentiment = 0;
        let positionCount = 0;

        positions.forEach(traderPositions => {
            traderPositions.perp.forEach(position => {
                totalSentiment += Math.sign(position.size);
                positionCount++;
            });
        });

        const averageSentiment = totalSentiment / positionCount;
        if (averageSentiment > 0.2) return 'bullish';
        if (averageSentiment < -0.2) return 'bearish';
        return 'neutral';
    }

    private analyzeRisk(positions: Array<{ perp: TraderPosition[]; spot: TraderPosition[] }>): string {
        let highLeverageCount = 0;
        let totalPositions = 0;

        positions.forEach(traderPositions => {
            traderPositions.perp.forEach(position => {
                if (position.leverage > 10) highLeverageCount++;
                totalPositions++;
            });
        });

        const highLeverageRatio = highLeverageCount / totalPositions;
        if (highLeverageRatio > 0.5) return 'High risk: Many positions use high leverage';
        if (highLeverageRatio > 0.2) return 'Moderate risk: Some positions use high leverage';
        return 'Low risk: Most positions use conservative leverage';
    }

    private analyzeTradingActivity(traders: any[]): string {
        const avgTradeCount = traders.reduce((sum, trader) => sum + trader.tradeCount, 0) / traders.length;
        const avgOpenPositions = traders.reduce((sum, trader) => sum + trader.totalOpenPositions, 0) / traders.length;

        return `Average trade count: ${avgTradeCount.toFixed(2)}. Average open positions: ${avgOpenPositions.toFixed(
            2
        )}.`;
    }
}
