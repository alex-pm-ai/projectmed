// Polyfill mínimo de localStorage para o ambiente node do vitest.
// O `persist` do Zustand (authStore) acessa localStorage na carga do módulo.
class LocalStorageMock {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
}

if (!('localStorage' in globalThis)) {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new LocalStorageMock() as unknown as Storage;
}
