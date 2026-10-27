import { describe, test, expect } from "bun:test";
import { pricingPlans } from "./pricing";

describe("two-plan public offer", () => {
  test("Base costs $29 monthly", () => { expect(pricingPlans[0].price).toBe(29); });
  test("Pro costs $59 monthly", () => { expect(pricingPlans[1].price).toBe(59); });
  test("only two paid plans are offered", () => { expect(pricingPlans.length).toBe(2); });
});