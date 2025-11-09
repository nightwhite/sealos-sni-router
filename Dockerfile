# ============================================================================
# 构建阶段
# ============================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock* ./

# 安装所有依赖（包括 devDependencies）
RUN bun install --frozen-lockfile

# 复制源代码
COPY src ./src
COPY public ./public
COPY tsconfig.json ./

# 根据目标架构编译项目
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      bun build --compile --target=bun-linux-arm64 ./src/index.ts --outfile server; \
    else \
      bun build --compile --target=bun-linux-x64 ./src/index.ts --outfile server; \
    fi

# ============================================================================
# 运行阶段
# ============================================================================
FROM oven/bun:1-alpine

# 安装必要工具
RUN apk add --no-cache \
    curl \
    bash

WORKDIR /app

# 创建数据目录（用于 SQLite 持久化）
RUN mkdir -p /data

# 从构建阶段复制编译后的可执行文件
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# 环境变量
ENV PORT=3000
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000 9443

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动编译后的可执行文件
CMD ["./server"]

