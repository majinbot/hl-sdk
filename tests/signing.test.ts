import { expect, test, describe } from "bun:test";
import {Wallet} from "ethers";
import {
    signL1Action,
    orderTypeToWire,
    floatToWire,
    orderRequestToOrderWire,
} from "../src";

describe("Signing Utilities", () => {
    test("orderTypeToWire converts limit order correctly", () => {
        const limitOrder = { limit: { tif: "Gtc" as const } };
        expect(orderTypeToWire(limitOrder)).toEqual(limitOrder);
    });

    test("orderTypeToWire converts trigger order correctly", () => {
        const triggerOrder = {
            trigger: { triggerPx: 50000, isMarket: true, tpsl: "tp" as const },
        };
        const result = orderTypeToWire(triggerOrder);
        expect(result).toEqual({
            trigger: { triggerPx: 50000, isMarket: true, tpsl: "tp" },
        });
    });

    test("floatToWire converts number to string correctly", () => {
        expect(floatToWire(123.456)).toBe("123.456");
        expect(floatToWire(123.4560)).toBe("123.456");
        expect(floatToWire(123)).toBe("123");
        expect(floatToWire(0)).toBe("0");
        expect(floatToWire(-0)).toBe("0");
    });

    test("orderRequestToOrderWire converts order request correctly", () => {
        const orderRequest = {
            coin: "BTC-PERP",
            is_buy: true,
            sz: 1,
            limit_px: 50000,
            order_type: { limit: { tif: "Gtc" as const } },
            reduce_only: false,
        };
        const result = orderRequestToOrderWire(orderRequest, 1);
        expect(result).toEqual({
            a: 1, // Assuming BTC-PERP has index 1
            b: true,
            p: "50000",
            s: "1",
            r: false,
            t: { limit: { tif: "Gtc" } },
        });
    });

    test("signL1Action signs action correctly", async () => {
        const wallet = Wallet.createRandom();
        const action = { type: "test" };
        const signature = await signL1Action(wallet, action, null, 123456);

        expect(signature).toHaveProperty("r");
        expect(signature).toHaveProperty("s");
        expect(signature).toHaveProperty("v");
        expect(typeof signature.r).toBe("string");
        expect(typeof signature.s).toBe("string");
        expect(typeof signature.v).toBe("number");
    });
});