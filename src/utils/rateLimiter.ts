export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number;

    constructor() {
        this.capacity = 1200; // 1200 tokens per minute
        this.refillRate = this.capacity / 60; // tokens per second
        this.tokens = this.capacity;
        this.lastRefill = Date.now();
    }

    async waitForToken(weight: number = 1): Promise<void> {
        if (weight > this.capacity) {
            throw new Error("Requested tokens exceed capacity");
        }

        await this.refillTokens();
        while (this.tokens < weight) {
            const waitTime = (weight - this.tokens) / this.refillRate * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            await this.refillTokens();
        }
        this.tokens -= weight;
    }

    private async refillTokens(): Promise<void> {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefill) / 1000;
        const newTokens = elapsedSeconds * this.refillRate;
        this.tokens = Math.min(this.capacity, this.tokens + newTokens);
        this.lastRefill = now;
    }
}