import {expect, test, describe, beforeEach, afterEach} from "bun:test";
import { RateLimiter } from "../src";

describe("RateLimiter", () => {
    let rateLimiter: RateLimiter;
    let mockNow: number;

    beforeEach(() => {
        rateLimiter = new RateLimiter();
        mockNow = Date.now();
        global.Date.now = () => mockNow;
    });

    afterEach(() => {
        global.Date.now = Date.now.bind(global.Date);
    });

    test("should initialize with full capacity", () => {
        expect(rateLimiter["tokens"]).toBe(1200);
    });

    test("should consume tokens correctly", async () => {
        await rateLimiter.waitForToken(500);
        expect(rateLimiter["tokens"]).toBe(700);
    });

    test("should throw error if requesting more tokens than capacity", async () => {
        await expect(rateLimiter.waitForToken(1201)).rejects.toThrow("Requested tokens exceed capacity");
    });

    test("should refill tokens after 1 minute", async () => {
        await rateLimiter.waitForToken(1000);
        expect(rateLimiter["tokens"]).toBe(200);

        // Move time forward by 1 minute
        mockNow += 60000;

        await rateLimiter.waitForToken(1);
        expect(rateLimiter["tokens"]).toBeCloseTo(1199, 0);
    });

    test("should wait if not enough tokens available", async () => {
        await rateLimiter.waitForToken(1100);
        expect(rateLimiter["tokens"]).toBeCloseTo(100, 0);

        const waitPromise = rateLimiter.waitForToken(200);

        // Move time forward by 1 minute
        mockNow += 60000;

        await waitPromise;

        expect(rateLimiter["tokens"]).toBeCloseTo(1000, 0);
    }, 10000);  // Increase timeout to 10 seconds
});