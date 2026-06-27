// Small seeded RNG (mulberry32) for deterministic-ish runs + helpers.
export class RNG {
  constructor(seed = 12345) { this.s = seed >>> 0; }
  next() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  // Weighted pick. items: [{weight,...}]
  weighted(items, weightFn = it => it.weight) {
    let total = 0; for (const it of items) total += weightFn(it);
    let r = this.next() * total;
    for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}
export const rand = new RNG(Date.now() & 0xffffffff || 1);
