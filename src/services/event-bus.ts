import { EventEmitter } from 'events';

/**
 * 内存级事件总线
 * 提供类似 Redis Pub/Sub 的功能，但完全在内存中运行
 * 用于单机模式（SQLite + 内存）
 */
export class EventBus extends EventEmitter {
  private subscribers: Map<string, Set<(message: string) => void>> = new Map();
  private messageHistory: Map<string, string[]> = new Map();
  private maxHistorySize = 100;

  /**
   * 订阅频道
   */
  subscribe(channel: string, callback?: (message: string) => void): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    if (callback) {
      this.subscribers.get(channel)!.add(callback);
    }

    this.on(channel, callback || (() => {}));
  }

  /**
   * 取消订阅
   */
  unsubscribe(channel: string, callback?: (message: string) => void): void {
    if (!this.subscribers.has(channel)) return;

    if (callback) {
      this.subscribers.get(channel)!.delete(callback);
    }

    if (callback) {
      this.removeListener(channel, callback);
    }
  }

  /**
   * 发布消息
   */
  publish(channel: string, message: string): number {
    const subscribers = this.subscribers.get(channel);
    const count = subscribers ? subscribers.size : 0;

    // 保存消息历史
    if (!this.messageHistory.has(channel)) {
      this.messageHistory.set(channel, []);
    }
    const history = this.messageHistory.get(channel)!;
    history.push(message);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // 发送消息给所有订阅者
    this.emit(channel, message);

    return count;
  }

  /**
   * 获取频道的消息历史
   */
  getHistory(channel: string): string[] {
    return this.messageHistory.get(channel) || [];
  }

  /**
   * 清空频道的消息历史
   */
  clearHistory(channel: string): void {
    this.messageHistory.delete(channel);
  }

  /**
   * 获取所有订阅的频道
   */
  getChannels(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * 获取频道的订阅者数量
   */
  getSubscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size || 0;
  }

  /**
   * 清空所有订阅
   */
  clear(): void {
    this.subscribers.clear();
    this.messageHistory.clear();
    this.removeAllListeners();
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

