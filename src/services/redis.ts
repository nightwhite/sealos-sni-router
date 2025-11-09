import type { Redis as RedisType } from 'ioredis'
import RedisClient from 'ioredis'
import { config } from '../config.ts'

// Redis 客户端（如果配置了 REDIS_URL）
export const redis: RedisType | null = config.REDIS_URL ? (new (RedisClient as any)(config.REDIS_URL, {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
})) : null

// Redis 订阅客户端（如果配置了 REDIS_URL）
export const redisSub: RedisType | null = config.REDIS_URL ? (new (RedisClient as any)(config.REDIS_URL, {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})) : null

if (redis) {
  redis.on('connect', () => {
    console.log('✅ Redis 连接成功')
  })

  redis.on('error', (err: Error) => {
    console.error('❌ Redis 错误:', err)
  })
}

if (redisSub) {
  redisSub.on('connect', () => {
    console.log('✅ Redis Pub/Sub 连接成功')
  })

  redisSub.on('error', (err: Error) => {
    console.error('❌ Redis Pub/Sub 错误:', err)
  })
}

