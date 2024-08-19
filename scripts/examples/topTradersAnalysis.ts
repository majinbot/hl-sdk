import { HyperliquidAPI } from '../../src';
import type { LeaderboardFilter, TimeWindow, TraderPosition, LeaderboardEntry } from '../../src';
import { t } from 'tasai';

const highlight = t.bold.cyan.toFunction();
const header = t.bold.underline.magenta.toFunction();
const subHeader = t.bold.yellow.toFunction();
const positive = t.green.toFunction();
const negative = t.red.toFunction();
const value = t.bold.white.toFunction();

async function runTraderAnalysis() {
    const api = new HyperliquidAPI();

    const filter: LeaderboardFilter = {
        timeWindow: 'month' as TimeWindow,
        minAccountValue: 100_000,
        minVolume: 1_000_000,
        maxVolume: 100_000_000,
        minPnL: 10_000,
        minRoi: 0.5,
        maxAccounts: 3
    };

    try {
        console.log(header("Fetching and analyzing top traders..."));
        const analysis = await analyzeTradersData(api, filter);

        console.log(header("\nTop Traders:"));
        analysis.topTraders.forEach((trader, index) => {
            console.log(subHeader(`\n#${index + 1}:`));
            console.log(`Address: ${highlight(trader.ethAddress)}`);
            console.log(`Account Value: ${value('$' + formatNumber(trader.accountValue))}`);
            console.log(`PnL: ${formatPnL(trader.windowPerformances[0][1].pnl)}`);
            console.log(`ROI: ${formatPercentage(trader.windowPerformances[0][1].roi)}`);
            console.log(`Volume: ${value('$' + formatNumber(trader.windowPerformances[0][1].vlm))}`);
            console.log(`Open Positions: ${value(trader.totalOpenPositions)}`);
            console.log(`Trade Count: ${value(trader.tradeCount)}`);
        });

        console.log(header("\nOverall Analysis:"));
        console.log(`Shared Assets: ${highlight(analysis.analysis.sharedAssets.join(', '))}`);
        console.log(`Overall Sentiment: ${formatSentiment(analysis.analysis.overallSentiment)}`);
        console.log(`Risk Analysis: ${value(analysis.analysis.riskAnalysis)}`);
        console.log(`Trading Activity: ${value(analysis.analysis.tradingActivity)}`);

    } catch (error) {
        console.error(negative("Error running trader analysis:"), error);
    } finally {
        api.disconnect();
    }
}

async function analyzeTradersData(api: HyperliquidAPI, filter: LeaderboardFilter, sortBy: 'pnl' | 'roi' | 'vlm' | 'accountValue' = 'pnl') {
    const leaderboard = await api.leaderboard.getLeaderboard();
    const filteredLeaderboard = await api.leaderboard.filterLeaderboard(leaderboard, filter);
    const sortedLeaderboard = api.leaderboard.sortLeaderboard(filteredLeaderboard, sortBy, filter.timeWindow);
    const topTraders = sortedLeaderboard.slice(0, filter.maxAccounts);

    const extendedTraderInfo = await Promise.all(
        topTraders.map(trader => getExtendedTraderInfo(api, trader, filter.timeWindow || 'allTime'))
    );

    return {
        topTraders: extendedTraderInfo,
        analysis: {
            sharedAssets: findSharedAssets(extendedTraderInfo.map(info => info.openPositions)),
            overallSentiment: calculateOverallSentiment(extendedTraderInfo.map(info => info.openPositions)),
            riskAnalysis: analyzeRisk(extendedTraderInfo.map(info => info.openPositions)),
            tradingActivity: analyzeTradingActivity(extendedTraderInfo),
        },
    };
}

async function getExtendedTraderInfo(api: HyperliquidAPI, trader: LeaderboardEntry, timeWindow: TimeWindow): Promise<any> {
    const openPositions = await api.leaderboard.getTraderOpenPositions(trader.ethAddress);
    const tradeCount = await api.leaderboard.getTraderTradeCount(trader.ethAddress, getStartTimeForWindow(timeWindow), Date.now());

    return {
        ...trader,
        openPositions,
        totalOpenPositions: openPositions.perp.length + openPositions.spot.length,
        tradeCount: tradeCount.total,
    };
}

function findSharedAssets(positions: Array<{ perp: TraderPosition[]; spot: TraderPosition[] }>): string[] {
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

function calculateOverallSentiment(
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

function analyzeRisk(positions: Array<{ perp: TraderPosition[]; spot: TraderPosition[] }>): string {
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

function analyzeTradingActivity(traders: any[]): string {
    const avgTradeCount = traders.reduce((sum, trader) => sum + trader.tradeCount, 0) / traders.length;
    const avgOpenPositions = traders.reduce((sum, trader) => sum + trader.totalOpenPositions, 0) / traders.length;

    return `Average trade count: ${avgTradeCount.toFixed(2)}. Average open positions: ${avgOpenPositions.toFixed(2)}.`;
}

function getStartTimeForWindow(timeWindow: TimeWindow): number {
    const now = Date.now();
    switch (timeWindow) {
        case 'day': return now - 24 * 60 * 60 * 1000;
        case 'week': return now - 7 * 24 * 60 * 60 * 1000;
        case 'month': return now - 30 * 24 * 60 * 60 * 1000;
        default: return 0; // For 'allTime', return 0 to get all trades
    }
}

function formatNumber(value: string | number, decimals: number = 2): string {
    return parseFloat(value.toString()).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function formatPercentage(value: string | number): string {
    const percentage = (parseFloat(value.toString()) * 100).toFixed(2);
    return percentage.startsWith('-') ? negative(`${percentage}%`) : positive(`${percentage}%`);
}

function formatPnL(value: string | number): string {
    const formatted = `$${formatNumber(value)}`;
    return parseFloat(value.toString()) >= 0 ? positive(formatted) : negative(formatted);
}

function formatSentiment(sentiment: 'bullish' | 'bearish' | 'neutral'): string {
    switch (sentiment) {
        case 'bullish': return positive(sentiment);
        case 'bearish': return negative(sentiment);
        default: return value(sentiment);
    }
}

runTraderAnalysis().then(() => {
    console.log(highlight("\nAnalysis complete. Exiting..."));
    process.exit(0);
}).catch(error => {
    console.error(negative("Unhandled error:"), error);
    process.exit(1);
});