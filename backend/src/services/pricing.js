/**
 * Dynamic pricing formula.
 *  basePrice = a*subs + b*views + c*avgLikesPerVideo
 *  finalPrice = basePrice * demandMultiplier
 *  demandMultiplier = 1 + (buys24h - sells24h) / max(totalSupply, 1)
 *
 * Returned price is in MATIC (a float). The caller converts to wei
 * with ethers.parseEther() before sending to contract.
 */
export function computePrice({
  subscribers = 0,
  views = 0,
  likesPerVideo = 0,
  buys24h = 0,
  sells24h = 0,
  totalSupply = 1,
}) {
  const A = 0.000002;
  const B = 0.0000001;
  const C = 0.00005;

  const base = A * subscribers + B * views + C * likesPerVideo;
  const demand = 1 + (buys24h - sells24h) / Math.max(totalSupply, 1);
  const price = Math.max(0.00001, base * Math.max(0.1, demand));
  return Number(price.toFixed(8));
}
