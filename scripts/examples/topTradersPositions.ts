import {HyperliquidAPI} from "../../src";
import type { BestTrade, LeaderboardFilter, TimeWindow, TraderPosition, UserFill } from "../../src";
import {Color, t} from "tasai";
const highlight = t.bold.cyan.toFunction();
const header = t.bold.underline.magenta.toFunction();
const subHeader = t.bold.yellow.toFunction();
const positive = t.green.toFunction();
const negative = t.red.toFunction();
const ticker = t.bold.magenta.toFunction();
const value = t.bold.white.toFunction();
const divider = "─".repeat(50);

const leverageColor = (leverage: number) => {
    if (leverage < 3) return t.green.toFunction();
    if (leverage < 10) return t.fromColor(Color.ORANGE).toFunction(); // Orange
    return t.brightRed.toFunction();
};


async function runLeaderboardAnalysis() {
    const api = new HyperliquidAPI();

    const filter: LeaderboardFilter = {
        timeWindow: 'month' as TimeWindow,
        minAccountValue: 100_000,
        minVolume: 1_000_000,
        maxVolume: 100_000_000,
        minPnL: 10_000,
        minRoi: 0.5,
        maxAccounts: 3
        // This adds majorly to HL API usage
        //maxTrades: 1000
    };

    try {
        console.log(header("Fetching leaderboard data..."));
        const leaderboard = await api.leaderboard.getLeaderboard();
        console.log(highlight(`Total traders: ${leaderboard.leaderboardRows.length}`));

        console.log(header("\nFiltering leaderboard, this may take a while..."));
        const filteredLeaderboard = await api.leaderboard.filterLeaderboard(leaderboard, filter);

        console.log(header("\nSorting leaderboard..."));
        const sortedLeaderboard = api.leaderboard.sortLeaderboard(filteredLeaderboard, 'pnl', filter.timeWindow);
        const topTraders = sortedLeaderboard.slice(0, filter.maxAccounts);

        if (topTraders.length === 0) {
            console.log(negative("No traders found matching the specified criteria."));
        } else {
            console.log(header("\nTop Traders:"));
            for (const [index, trader] of topTraders.entries()) {
                const performance = trader.windowPerformances.find(([window]) => window === filter.timeWindow)?.[1];

                console.log(divider);
                console.log(subHeader(`\n#${index + 1}:`));
                console.log(highlight(`Address: ${trader.ethAddress}`));
                console.log(`Account Value: ${value('$' + formatNumber(trader.accountValue))}`);
                console.log(`PnL: ${formatPnL(performance?.pnl)}`);
                console.log(`ROI: ${formatPercentage(performance?.roi)}`);
                console.log(`Volume: ${value('$' + formatNumber(performance?.vlm))}`);

                // Fetch and display current positions
                const positions = await api.leaderboard.getTraderOpenPositions(trader.ethAddress);
                console.log(subHeader("\nCurrent Positions:"));
                if (positions.perp.length > 0 || positions.spot.length > 0) {
                    if (positions.perp.length > 0) {
                        console.log(highlight("  Perpetual:"));
                        positions.perp.forEach(displayPosition);
                    }
                    if (positions.spot.length > 0) {
                        console.log(highlight("  Spot:"));
                        positions.spot.forEach(displayPosition);
                    }
                } else {
                    console.log("  No open positions");
                }

                // Fetch and display best trade
                const bestTrade = await api.leaderboard.getBestTrade(trader.ethAddress, filter.timeWindow!);
                if (bestTrade) {
                    console.log(subHeader("\nBest Trade:"));
                    console.log(`  Asset: ${ticker(bestTrade.coin)}`);
                    console.log(`  Market: ${value(bestTrade.isPerp ? 'Perpetual' : 'Spot')}`);
                    console.log(`  Side: ${bestTrade.side === 'buy' ? positive(bestTrade.side) : negative(bestTrade.side)}`);
                    console.log(`  Price: ${value('$' + formatNumber(bestTrade.px))}`);
                    console.log(`  Size: ${value(formatNumber(bestTrade.sz, 4))}`);
                    if (bestTrade.isPerp && bestTrade.leverage !== 1) {
                        const levColor = leverageColor(bestTrade.leverage!);
                        console.log(`  Leverage: ${levColor(bestTrade.leverage + 'x')}`);
                    }
                    console.log(`  PnL: ${formatPnL(bestTrade.closedPnl)}`);
                    console.log(`  Time: ${new Date(bestTrade.time).toLocaleString()}`);
                    if (bestTrade.liquidation) {
                        console.log(highlight("  Liquidation:"));
                        console.log(`    Liquidated User: ${value(bestTrade.liquidation.liquidatedUser)}`);
                        console.log(`    Mark Price: ${value('$' + formatNumber(bestTrade.liquidation.markPx))}`);
                        console.log(`    Method: ${value(bestTrade.liquidation.method)}`);
                    }
                } else {
                    console.log(negative("\nNo trades found for this period"));
                }
            }
        }
    } catch (error) {
        console.error(negative("Error running leaderboard analysis:"), error);
    } finally {
        api.disconnect();
    }
}

function displayPosition(position: TraderPosition) {
    console.log(`    ${ticker(position.asset)}: ${value(formatNumber(position.size, 4))} ${position.entryPrice ? `@ $${value(formatNumber(position.entryPrice))}` : ''}`);
    if (position.unrealizedPnl !== null) {
        console.log(`      Unrealized PnL: ${formatPnL(position.unrealizedPnl.toString())}`);
    }
    if (position.leverage !== 1) {
        const leverageStyled = leverageColor(position.leverage)(`${position.leverage}x`);
        console.log(`      Leverage: ${leverageStyled}`);
    }
}

function formatNumber(value: string | number | undefined, decimals: number = 2): string {
    return parseFloat(value?.toString() || '0').toLocaleString('en-US', {maximumFractionDigits: decimals});
}

function formatPercentage(value: string | number | undefined): string {
    const percentage = (parseFloat(value?.toString() || '0') * 100).toFixed(2);
    return percentage.startsWith('-') ? negative(`${percentage}%`) : positive(`${percentage}%`);
}

function formatPnL(value: string | number | undefined): string {
    const formatted = `$${formatNumber(value)}`;
    return parseFloat(value?.toString() || '0') >= 0 ? positive(formatted) : negative(formatted);
}

runLeaderboardAnalysis().then(() => {
    console.log(highlight("\nAnalysis complete. Exiting..."));
    process.exit(0);
}).catch(error => {
    console.error(negative("Unhandled error:"), error);
    process.exit(1);
});