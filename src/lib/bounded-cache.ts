/** Cache LRU borné ; la durée est indépendante de celle de TanStack Query. */
export class BoundedCache<K, V> {
  private entries = new Map<K, { value: V; expires: number }>();
  constructor(
    private readonly maxEntries = 64,
    private readonly ttlMs = 15 * 60_000,
  ) {
    if (maxEntries < 1 || ttlMs <= 0)
      throw new Error("Limites de cache invalides");
  }
  get size() {
    return this.entries.size;
  }
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= Date.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: K, value: V) {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
    return this;
  }
  delete(key: K) {
    return this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
}
