import { EventEmitter } from 'events';
import { redis, redisSub } from './redis.ts';
import { config } from '../config.ts';
import { getDatabase, getDatabaseType, schema } from '../db/index.ts';
import { eventBus } from './event-bus.ts';

export interface Service {
  domain: string;
  service: string;
  port: number;
}

export type StorageMode = 'sqlite-memory' | 'sqlite-eventbus' | 'postgresql-redis';

export class ConfigManager extends EventEmitter {
  private services: Map<string, Service> = new Map();
  private stats: Map<string, number> = new Map();
  private isInitialized = false;
  private storageMode: StorageMode;
  private db: any;

  constructor() {
    super();
    this.db = getDatabase();
    this.storageMode = this.detectStorageMode();
    this.init();
  }

  private detectStorageMode(): StorageMode {
    const dbType = getDatabaseType();
    const hasRedis = !!config.REDIS_URL;

    if (dbType === 'sqlite' && !hasRedis) {
      // SQLite + 内存模式：单机，数据持久化到 SQLite
      return 'sqlite-memory';
    } else if (dbType === 'sqlite' && hasRedis) {
      // SQLite + EventBus 模式：单机，使用内存事件总线（不需要 Redis）
      return 'sqlite-eventbus';
    } else if (dbType === 'postgresql' && hasRedis) {
      // PostgreSQL + Redis 模式：高可用分布式
      return 'postgresql-redis';
    } else {
      // 默认使用 sqlite-memory
      console.warn('⚠️  存储配置不匹配，使用默认的 sqlite-memory 模式');
      return 'sqlite-memory';
    }
  }

  private async init() {
    try {
      if (this.storageMode === 'postgresql-redis') {
        await this.initPostgresqlRedis();
      } else if (this.storageMode === 'sqlite-eventbus') {
        await this.initSqliteEventBus();
      } else {
        await this.initSqliteMemory();
      }
      this.isInitialized = true;
      console.log(`✅ 配置管理器初始化完成 (模式: ${this.storageMode})`);
    } catch (error) {
      console.error('❌ 配置管理器初始化失败:', error);
      this.isInitialized = true;
    }
  }

  private async initSqliteMemory() {
    // SQLite + 内存模式：单机模式
    if (this.db) {
      try {
        const services = await this.db.select().from(schema.sqliteServices);
        this.services.clear();
        services.forEach((s: any) => {
          this.services.set(s.domain, {
            domain: s.domain,
            service: s.service,
            port: s.port,
          });
        });
        console.log(`✅ 从 SQLite 加载了 ${services.length} 个服务`);
      } catch (error) {
        console.error('❌ 从 SQLite 加载配置失败:', error);
      }
    }
  }

  private async initSqliteEventBus() {
    // SQLite + EventBus 模式：单机，使用内存事件总线
    if (this.db) {
      try {
        const services = await this.db.select().from(schema.sqliteServices);
        this.services.clear();
        services.forEach((s: any) => {
          this.services.set(s.domain, {
            domain: s.domain,
            service: s.service,
            port: s.port,
          });
        });
        console.log(`✅ 从 SQLite 加载了 ${services.length} 个服务`);
      } catch (error) {
        console.error('❌ 从 SQLite 加载配置失败:', error);
      }
    }

    // 订阅事件总线
    eventBus.subscribe('sni-router:config-changed', () => {
      this.loadFromSqlite();
    });
  }

  private async loadFromSqlite() {
    if (!this.db) return;

    try {
      const services = await this.db.select().from(schema.sqliteServices);
      this.services.clear();
      services.forEach((s: any) => {
        this.services.set(s.domain, {
          domain: s.domain,
          service: s.service,
          port: s.port,
        });
      });
      this.emit('config-changed');
      console.log(`✅ 从 SQLite 重新加载了 ${services.length} 个服务`);
    } catch (error) {
      console.error('❌ 从 SQLite 加载配置失败:', error);
    }
  }

  private async initPostgresqlRedis() {
    // PostgreSQL + Redis 模式：高可用分布式模式
    if (!redisSub) {
      console.error('❌ Redis 未初始化，无法使用 postgresql-redis 模式');
      return;
    }

    // 订阅配置变更
    await redisSub.subscribe('sni-router:config-changed');
    redisSub.on('message', (channel) => {
      if (channel === 'sni-router:config-changed') {
        this.loadFromRedis();
      }
    });

    // 初始加载
    await this.loadFromRedis();
  }

  // 从 Redis 加载配置（PostgreSQL + Redis 模式）
  private async loadFromRedis() {
    if (!redis) return;

    try {
      const data = await redis.get('sni-router:services');
      if (data) {
        const services: Service[] = JSON.parse(data);
        this.services.clear();
        services.forEach(s => this.services.set(s.domain, s));
        this.emit('config-changed');
        console.log(`✅ 从 Redis 加载了 ${services.length} 个服务`);
      }
    } catch (error) {
      console.error('❌ 从 Redis 加载配置失败:', error);
    }
  }

  // 保存配置
  private async saveConfig() {
    if (this.storageMode === 'postgresql-redis' && redis) {
      try {
        const services = Array.from(this.services.values());
        await redis.set('sni-router:services', JSON.stringify(services));
        await redis.publish('sni-router:config-changed', Date.now().toString());
        console.log(`✅ 配置已保存到 Redis，通知其他副本`);
      } catch (error) {
        console.error('❌ 保存配置到 Redis 失败:', error);
        throw error;
      }
    } else if ((this.storageMode === 'sqlite-memory' || this.storageMode === 'sqlite-eventbus') && this.db) {
      try {
        // SQLite 模式：保存到数据库
        for (const service of this.services.values()) {
          await this.db
            .insert(schema.sqliteServices)
            .values(service)
            .onConflictDoUpdate({
              target: schema.sqliteServices.domain,
              set: { service: service.service, port: service.port },
            });
        }
        this.emit('config-changed');

        // sqlite-eventbus 模式：发布事件
        if (this.storageMode === 'sqlite-eventbus') {
          eventBus.publish('sni-router:config-changed', Date.now().toString());
        }

        console.log(`✅ 配置已保存到 SQLite`);
      } catch (error) {
        console.error('❌ 保存配置到 SQLite 失败:', error);
        throw error;
      }
    } else {
      // 纯内存模式
      this.emit('config-changed');
      console.log(`✅ 配置已更新（内存存储）`);
    }
  }

  // 添加服务
  async addService(service: Service) {
    this.services.set(service.domain, service);
    await this.saveConfig();
  }

  // 删除服务
  async deleteService(domain: string) {
    this.services.delete(domain);
    await this.saveConfig();
  }
  
  // 获取所有服务
  getServices(): Service[] {
    return Array.from(this.services.values());
  }
  
  // 根据 SNI 查找后端
  findBackend(sni: string): Service | null {
    // 精确匹配
    if (this.services.has(sni)) {
      return this.services.get(sni)!;
    }
    
    // 通配符匹配
    for (const [domain, service] of this.services) {
      if (domain.startsWith('*.')) {
        const pattern = domain.substring(2); // 去掉 *.
        if (sni.endsWith(pattern)) {
          return service;
        }
      }
    }
    
    return null;
  }
  
  // 记录统计
  recordConnection(sni: string) {
    const count = this.stats.get(sni) || 0;
    this.stats.set(sni, count + 1);
  }
  
  // 获取统计
  getStats() {
    const stats: Record<string, number> = {};
    this.stats.forEach((count, sni) => {
      stats[sni] = count;
    });
    return {
      totalServices: this.services.size,
      connections: stats,
      totalConnections: Array.from(this.stats.values()).reduce((a, b) => a + b, 0)
    };
  }
  
  // 等待初始化完成
  async waitForInit() {
    if (this.isInitialized) return;
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}

// 单例
export const configManager = new ConfigManager();

