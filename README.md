# 🚀 Sealos SNI Router

**为 Sealos/Kubernetes 环境设计的高性能 SNI 路由器 - 用单个 NodePort 支持多个域名！**

## 📦 项目说明

这是一个基于 Bun + Elysia 实现的 SNI（Server Name Indication）路由器，专为 Sealos/Kubernetes 环境设计。通过单个 NodePort（如 32271），支持多个域名，每个域名可以路由到不同的后端服务 TCP 端口。

### ✨ 核心特性

- ✅ **单 NodePort 多域名**：用一个 NodePort 支持多个域名
- ✅ **纯 Bun 实现**：使用 Bun 原生 TCP Socket，无需 HAProxy
- ✅ **SNI 路由**：基于 TLS ClientHello 的 SNI 字段进行路由
- ✅ **Web 管理界面**：实时添加/删除服务，查看统计信息
- ✅ **通配符支持**：支持 `*.example.com` 通配符域名
- ✅ **数据持久化**：支持 SQLite 和 PostgreSQL 数据库
- ✅ **多副本同步**：可选 Redis 支持，实现多副本配置同步
- ✅ **零停机更新**：配置变更立即生效，无需重启
- ✅ **高性能**：Bun 原生性能，比 Node.js 快 3-4 倍
- ✅ **容器化部署**：多阶段 Docker 构建，镜像体积小，启动快
- ✅ **Sealos 友好**：专为 Sealos/Kubernetes 环境优化

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone <repository-url>
cd sealos-sni-router

# 2. 安装依赖
bun install

# 3. 配置环境变量（可选）
cp .env.example .env.local
# 编辑 .env.local 设置端口等配置

# 4. 启动开发服务器（带热重载）
bun dev
```

访问 http://localhost:3000（默认端口，可在 `.env.local` 中配置 `PORT`）

### Docker 部署

#### 方式 1：使用 Docker（SQLite 持久化）

```bash
# 构建镜像
docker build -t sealos-sni-router .

# 运行容器（挂载 /data 目录实现持久化）
docker run -d \
  -p 3000:3000 \
  -p 9443:9443 \
  -v $(pwd)/data:/data \
  --name sni-router \
  sealos-sni-router
```

#### 方式 2：使用 Docker（PostgreSQL + Redis 高可用）

```bash
# 运行容器
docker run -d \
  -p 3000:3000 \
  -p 9443:9443 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  --name sni-router \
  sealos-sni-router
```

#### 方式 3：使用 GitHub Container Registry

```bash
# 拉取镜像（推送代码后自动构建）
docker pull ghcr.io/<your-username>/sealos-sni-router:latest

# 运行容器
docker run -d \
  -p 3000:3000 \
  -p 9443:9443 \
  -v $(pwd)/data:/data \
  --name sni-router \
  ghcr.io/<your-username>/sealos-sni-router:latest
```

### Kubernetes 部署

参见下方 [Kubernetes 部署说明](#-kubernetes-部署说明)

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
│   ├── db/                   # 数据库
│   │   ├── index.ts          # 数据库连接
│   │   └── schema.ts         # 数据库 Schema
│   ├── routes/
│   │   └── services.ts       # API 路由
│   └── services/
│       ├── sni-router.ts     # SNI 路由器核心
│       ├── config-manager.ts # 配置管理器
│       ├── event-bus.ts      # 内存事件总线
│       ├── memory-store.ts   # 内存存储
│       └── redis.ts          # Redis 客户端
├── public/                    # 前端文件
│   ├── index.html            # Web 管理界面
│   ├── app.js                # 前端逻辑
│   └── style.css             # 样式
├── .github/
│   └── workflows/
│       └── docker-build.yml  # GitHub Actions 自动构建
├── Dockerfile                 # Docker 多阶段构建配置
├── .gitignore                # Git 忽略文件
├── .env.example              # 环境变量示例
├── package.json              # 依赖配置
├── tsconfig.json             # TypeScript 配置
└── README.md                 # 项目文档
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | Web 管理界面端口 |
| `NODE_ENV` | `development` | 运行环境（development/production/test） |
| `DATABASE_URL` | `sqlite:///data/sni-router.db` | 数据库连接 URL（SQLite 或 PostgreSQL） |
| `REDIS_URL` | `null` | Redis 连接 URL（可选，仅 PostgreSQL 模式需要） |

### 存储模式

项目支持三种存储模式：

1. **sqlite-memory**（默认）：SQLite + 内存，适合单机部署
2. **sqlite-eventbus**：SQLite + 内存事件总线，适合单机生产环境
3. **postgresql-redis**：PostgreSQL + Redis，适合 K8s 高可用部署

详见 `.env.example` 文件中的配置说明。

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
- **ORM**：Drizzle ORM
- **数据库**：SQLite / PostgreSQL
- **缓存/同步**：Redis（可选）
- **前端**：原生 HTML/CSS/JS
- **容器**：Docker（多阶段构建）
- **CI/CD**：GitHub Actions

## 📝 Kubernetes 部署说明

### 单机模式（SQLite）

适合开发和小规模部署，使用 SQLite 持久化存储。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sni-router-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sni-router
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sni-router
  template:
    metadata:
      labels:
        app: sni-router
    spec:
      containers:
      - name: sni-router
        image: ghcr.io/<your-username>/sealos-sni-router:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9443
          name: sni
        env:
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          value: "sqlite:///data/sni-router.db"
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: sni-router-data
---
apiVersion: v1
kind: Service
metadata:
  name: sni-router
spec:
  type: NodePort
  ports:
  - port: 3000
    targetPort: 3000
    name: http
  - port: 9443
    targetPort: 9443
    nodePort: 32271  # 你的 NodePort
    protocol: TCP
    name: sni
  selector:
    app: sni-router
```

### 高可用模式（PostgreSQL + Redis）

适合生产环境，支持多副本和配置同步。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sni-router
spec:
  replicas: 3  # 多副本
  selector:
    matchLabels:
      app: sni-router
  template:
    metadata:
      labels:
        app: sni-router
    spec:
      containers:
      - name: sni-router
        image: ghcr.io/<your-username>/sealos-sni-router:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9443
          name: sni
        env:
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          value: "postgresql://user:password@postgres-service:5432/sni_router"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
---
apiVersion: v1
kind: Service
metadata:
  name: sni-router
spec:
  type: NodePort
  ports:
  - port: 3000
    targetPort: 3000
    name: http
  - port: 9443
    targetPort: 9443
    nodePort: 32271  # 你的 NodePort
    protocol: TCP
    name: sni
  selector:
    app: sni-router
```

### 部署说明

1. **NodePort 配置**：在 Service 中指定 NodePort（如 32271）
2. **TLS 处理**：这是纯 TCP 路由，后端服务需要自己处理 TLS
3. **持久化存储**：
   - 单机模式：挂载 PVC 到 `/data` 目录
   - 高可用模式：使用 PostgreSQL + Redis
4. **镜像获取**：推送代码到 GitHub 后，GitHub Actions 会自动构建镜像

## 🔄 CI/CD

项目包含 GitHub Actions 工作流，自动构建和推送 Docker 镜像到 GitHub Container Registry。

### 触发条件

- 推送到 `main` 或 `master` 分支
- 创建以 `v` 开头的标签（如 `v1.0.0`）
- Pull Request

### 镜像标签

- `latest`：最新的 main/master 分支
- `v1.0.0`：语义化版本标签
- `main-<sha>`：带 Git SHA 的分支标签

---

**项目状态**：✅ 生产就绪

**最后更新**：2025-11-09

**适用场景**：Sealos、Kubernetes、多域名 HTTPS 路由

