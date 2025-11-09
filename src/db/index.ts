import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { Pool } from 'pg';
import { config } from '../config.ts';
import * as schema from './schema.ts';

type DbType = ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleSqlite>;

let db: DbType | null = null;
let dbType: 'sqlite' | 'postgresql' | null = null;
let sqliteClient: Database | null = null;
let pgPool: Pool | null = null;

export async function initializeDatabase() {
  const dbUrl = config.DATABASE_URL;

  if (!dbUrl) {
    console.log('⚠️  未配置 DATABASE_URL，使用内存存储');
    return null;
  }

  try {
    if (dbUrl.startsWith('sqlite://')) {
      // SQLite - 使用 Bun 原生 SQLite
      const filePath = dbUrl.replace('sqlite://', '');
      sqliteClient = new Database(filePath);
      db = drizzleSqlite(sqliteClient, { schema });
      dbType = 'sqlite';
      console.log(`✅ SQLite 数据库已连接: ${filePath}`);
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      // PostgreSQL
      pgPool = new Pool({ connectionString: dbUrl });
      db = drizzlePg(pgPool, { schema });
      dbType = 'postgresql';
      console.log(`✅ PostgreSQL 数据库已连接`);
    } else {
      console.error('❌ 不支持的数据库 URL 格式:', dbUrl);
      return null;
    }

    // 创建表
    await createTables();
    return db;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return null;
  }
}

async function createTables() {
  if (!db) return;

  try {
    if (dbType === 'sqlite' && sqliteClient) {
      // SQLite 自动创建表
      sqliteClient.run(`
        CREATE TABLE IF NOT EXISTS services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL UNIQUE,
          service TEXT NOT NULL,
          port INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);
      console.log('✅ SQLite 表已创建');
    } else if (dbType === 'postgresql' && pgPool) {
      // PostgreSQL 创建表
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          domain TEXT NOT NULL UNIQUE,
          service TEXT NOT NULL,
          port INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ PostgreSQL 表已创建');
    }
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  }
}

export function getDatabase() {
  return db;
}

export function getDatabaseType() {
  return dbType;
}

export * as schema from './schema.ts';

