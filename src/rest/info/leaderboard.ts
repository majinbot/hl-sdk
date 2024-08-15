import type { HttpApi } from '../../utils/helpers.ts';
import type { LeaderboardEntry, LeaderboardFilter, LeaderboardResponse, TimeWindow } from '../../types';
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

            // Update cache
            this.cache = {
                data: leaderboard,
                timestamp: Date.now(),
            };

            return leaderboard;
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            // If there's an error, and we have cached data, return it even if it's expired
            if (this.cache.data) {
                console.warn('Returning potentially outdated cached leaderboard data');
                return this.cache.data;
            }
            // If we have no cached data, rethrow the error
            throw error;
        }
    }

    async clearCache(): Promise<void> {
        this.cache = {
            data: null,
            timestamp: 0,
        };
    }

    filterLeaderboard(leaderboard: LeaderboardResponse, filter: LeaderboardFilter): LeaderboardEntry[] {
        let filteredEntries = leaderboard.leaderboardRows.filter(entry => {
            const performance = entry.windowPerformances.find(
                ([window]) => window === (filter.timeWindow || 'allTime')
            )?.[1];

            if (!performance) return false;

            return (
                (!filter.minAccountValue || parseFloat(entry.accountValue) >= filter.minAccountValue) &&
                (!filter.minVolume || parseFloat(performance.vlm) >= filter.minVolume) &&
                (!filter.minPnL || parseFloat(performance.pnl) >= filter.minPnL) &&
                (!filter.minRoi || parseFloat(performance.roi) >= filter.minRoi)
            );
        });

        // Apply maxAccounts filter if specified
        if (filter.maxAccounts && filter.maxAccounts > 0) {
            filteredEntries = filteredEntries.slice(0, filter.maxAccounts);
        }

        return filteredEntries;
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
        const filtered = this.filterLeaderboard(leaderboard, filter);
        return this.sortLeaderboard(filtered, sortBy, filter.timeWindow || 'allTime');
    }
}
