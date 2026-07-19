// Payment + deal-odds scoring. Same math as the dashboard, in one place.

export function payment(price, b) {
  const loan = Math.max(price - b.down, 0);
  const r = b.rate / 100 / 12;
  const pi = r > 0 ? (loan * r) / (1 - Math.pow(1 + r, -360)) : loan / 360;
  const tax = (price * b.taxRate) / 12;
  const pmi = price > 0 && loan / price > 0.8 ? (loan * b.pmiRate) / 12 : 0;
  return Math.round(pi + tax + b.insuranceMonthly + pmi);
}

// max purchase price that keeps the all-in payment at/under the target
export function envelope(b) {
  let lo = 50000, hi = 650000;
  for (let i = 0; i < 44; i++) {
    const m = (lo + hi) / 2;
    payment(m, b) > b.targetPayment ? (hi = m) : (lo = m);
  }
  return Math.round(lo / 1000) * 1000;
}

// deal odds from time-on-market + price-cut history (the negotiating-room signal)
export function dealOdds(listing) {
  const dom = listing.days_on_market || 0;
  const cuts = Array.isArray(listing.price_history) ? Math.max(listing.price_history.length - 1, 0) : 0;
  const p = payment(listing.price, listing._budget || {});
  let score = 0;
  if (dom >= 120) score += 2; else if (dom >= 45) score += 1;
  if (cuts >= 2) score += 2; else if (cuts >= 1) score += 1;
  if (listing._budget && p <= listing._budget.targetPayment) score += 1; // already affordable
  return score >= 4 ? "strong" : score >= 2 ? "fair" : "slim";
}
