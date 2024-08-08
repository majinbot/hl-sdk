import {HyperliquidAPI} from "../../src/api";

const api = new HyperliquidAPI();

// This will fetch from the API and cache the result
const leaderboard1 = await api.leaderboard.getFilteredAndSortedLeaderboard({
    timeWindow: 'month',
    minAccountValue: 100_000,
    maxAccounts: 1
}, 'roi');

// This will use the cached data
const leaderboard2 = await api.leaderboard.getFilteredAndSortedLeaderboard({
    timeWindow: 'week',
    minVolume: 1_000_000,
    maxAccounts: 1
}, 'pnl');

// If you need to clear the cache manually
await api.leaderboard.clearCache();

// This will fetch from the API again and cache the new result
const leaderboard3 = await api.leaderboard.getFilteredAndSortedLeaderboard({
    timeWindow: 'day',
    minRoi: 0.05,
    maxAccounts: 1
}, 'accountValue');

console.log(JSON.stringify(leaderboard1, null, 2));
console.log(JSON.stringify(leaderboard2, null, 2));
console.log(JSON.stringify(leaderboard3, null, 2));
