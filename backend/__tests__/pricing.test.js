import { computePrice } from "../src/services/pricing.js";

test("price grows with subs/views", () => {
  const low = computePrice({ subscribers: 100, views: 1000 });
  const high = computePrice({ subscribers: 100000, views: 1_000_000 });
  expect(high).toBeGreaterThan(low);
});

test("demand multiplier moves price", () => {
  const base = computePrice({
    subscribers: 10000, views: 100000, totalSupply: 1000,
  });
  const hot = computePrice({
    subscribers: 10000, views: 100000, totalSupply: 1000, buys24h: 800,
  });
  expect(hot).toBeGreaterThan(base);
});
