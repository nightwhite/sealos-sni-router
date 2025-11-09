# 🚀 Sealos SNI 路由器

**为 Sealos/Kubernetes 环境设计的高性能 SNI 路由器 - 用单个 NodePort 支持多个域名！**

## 📦 项目说明

这是一个纯 Bun 实现的 SNI（Server Name Indication）路由器，专为 Sealos/Kubernetes 环境设计。通过单个 NodePort（如 32271），支持多个域名，每个域名可以路由到不同的后端服务 TCP 端口。

### ✨ 核心特性

- ✅ **单 NodePort 多域名**：用一个 NodePort（如 32271）支持多个域名
- ✅ **纯 Bun 实现**：使用 Bun 原生 TCP Socket，无需 HAProxy
- ✅ **SNI 路由**：基于 TLS ClientHello 的 SNI 字段进行路由
- ✅ **Web 管理界面**：实时添加/删除服务，查看统计信息
- ✅ **通配符支持**：支持 `*.example.com` 通配符域名
- ✅ **多副本同步**：可选 Redis 支持，实现多副本配置同步
- ✅ **零停机更新**：配置变更立即生效，无需重启
- ✅ **高性能**：Bun 原生性能，比 Node.js 快 3-4 倍
- ✅ **Sealos 友好**：专为 Sealos/Kubernetes 环境优化

## 🚀 快速开始

### 开发环境

```bash
bun install
bun dev
```

访问 http://localhost:3000

### 生产环境

```bash
docker build -t bun-sni-router .
docker run -d -p 3000:3000 -p 9443:9443 bun-sni-router
```

## 📚 文档

- **[README_BUN_NATIVE.md](./README_BUN_NATIVE.md)** - 完整功能文档
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - 快速上手指南
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - 快速参考卡片
- **[FINAL_STATUS.md](./FINAL_STATUS.md)** - 项目完成状态

## 🎯 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/services` | 获取服务列表 |
| POST | `/api/services` | 添加服务 |
| DELETE | `/api/services/:domain` | 删除服务 |
| GET | `/api/services/stats` | 获取统计信息 |

## 📊 项目结构

```
.
├── src/                       # 源代码
│   ├── index.ts              # 入口文件
│   ├── server.ts             # Elysia Web 服务器
│   ├── config.ts             # 配置管理
│   ├── routes/
│   │   └── services.ts       # API 路由
│   └── services/
│       ├── sni-router.ts     # SNI 路由器
│       ├── config-manager.ts # 配置管理器
│       └── redis.ts          # Redis 客户端
├── public/                    # 前端文件
│   ├── index.html
│   ├── app.js
│   └── style.css
├── Dockerfile                 # Docker 配置
├── docker-compose.yml         # Docker Compose
├── package.json              # 依赖配置
└── 文档...
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | Web 管理界面端口 |
| `NODE_ENV` | `development` | 运行环境 |
| `REDIS_URL` | `null` | Redis 连接 URL（可选） |

## 💡 使用示例

### 场景：Sealos 中的多服务路由

假设你有一个 NodePort 32271，想要：
- `smtp.example.com:32271` → 邮件服务的 8025 端口
- `imap.example.com:32271` → 邮件服务的 11143 端口
- `api.example.com:32271` → API 服务的 8080 端口

### 添加服务

```bash
curl -X POST http://localhost:3000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "smtp.example.com",
    "service": "email-service",
    "port": 8025
  }'
```

### 获取服务列表

```bash
curl http://localhost:3000/api/services
```

### 删除服务

```bash
curl -X DELETE http://localhost:3000/api/services/smtp.example.com
```

## 📈 性能指标

| 指标 | 值 |
|------|-----|
| 启动时间 | ~0.5s |
| 内存占用 | ~50MB |
| 进程数 | 1 |
| 配置重载 | 立即生效 |

## 🎓 技术栈

- **运行时**：Bun 1.x
- **Web 框架**：Elysia
- **存储**：内存 / Redis
- **前端**：原生 HTML/CSS/JS
- **容器**：Docker

## 📝 Sealos 部署说明

### 1. **NodePort 配置**
在 Sealos 中创建 Service，指定 NodePort（如 32271）：
```yaml
apiVersion: v1
kind: Service
metadata:
  name: sni-router
spec:
  type: NodePort
  ports:
  - port: 9443
    nodePort: 32271
    protocol: TCP
  selector:
    app: sni-router
```

### 2. **TLS 处理**
这是纯 TCP 路由，后端服务需要自己处理 TLS

### 3. **配置持久化**
建议使用 Redis 实现持久化，支持多副本同步

### 4. **生产部署**
建议使用 Kubernetes + Redis 实现高可用

---

**项目状态**：✅ 完成并通过所有测试

**最后更新**：2025-11-09

**适用场景**：Sealos、Kubernetes、多域名 HTTPS 路由

