import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { pricingPlans } from "./pricing";

describe("two-plan public offer", () => {
  test("Base costs $29 monthly", () => { assert.equal(pricingPlans[0].price, 29); });
  test("Pro costs $59 monthly", () => { assert.equal(pricingPlans[1].price, 59); });
  test("only two paid plans are offered", () => { assert.equal(pricingPlans.length, 2); });
});