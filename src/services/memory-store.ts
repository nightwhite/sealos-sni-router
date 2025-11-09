/**
 * 内存级 KV 存储
 * 提供类似 Redis 的 SET/GET/DEL 功能，但完全在内存中运行
 * 用于单机模式（SQLite + 内存）
 */
export class MemoryStore {
  private store: Map<string, { value: string; expireAt?: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 定期清理过期的键
    this.startCleanup();
  }

  /**
   * 设置键值对
   */
  set(key: string, value: string, expiresIn?: number): void {
    const expireAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
    this.store.set(key, { value, expireAt });
  }

  /**
   * 获取值
   */
  get(key: string): string | null {
    const item = this.store.get(key);
    if (!item) return null;

    // 检查是否过期
    if (item.expireAt && item.expireAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * 删除键
   */
  del(key: string): number {
    return this.store.delete(key) ? 1 : 0;
  }

  /**
   * 检查键是否存在
   */
  exists(key: string): boolean {
    const item = this.store.get(key);
    if (!item) return false;

    // 检查是否过期
    if (item.expireAt && item.expireAt < Date.now()) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取所有键
   */
  keys(pattern?: string): string[] {
    const keys = Array.from(this.store.keys());
    if (!pattern) return keys;

    // 简单的模式匹配（支持 * 通配符）
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return keys.filter(key => regex.test(key));
  }

  /**
   * 获取存储大小
   */
  size(): number {
    return this.store.size;
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 设置键的过期时间
   */
  expire(key: string, seconds: number): boolean {
    const item = this.store.get(key);
    if (!item) return false;

    item.expireAt = Date.now() + seconds * 1000;
    return true;
  }

  /**
   * 获取键的剩余过期时间（秒）
   */
  ttl(key: string): number {
    const item = this.store.get(key);
    if (!item) return -2; // 键不存在

    if (!item.expireAt) return -1; // 键存在但没有过期时间

    const remaining = Math.ceil((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  /**
   * 启动定期清理过期键
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.store.entries()) {
        if (item.expireAt && item.expireAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 停止清理
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 销毁存储
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }
}

// 全局内存存储实例
export const memoryStore = new MemoryStore();

