import { config } from "./config.ts"
import { app } from "./server.ts"
import { startSNIRouter } from "./services/sni-router.ts"
import { initializeDatabase } from "./db/index.ts"

const signals = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
    process.on(signal, async () => {
        console.log(`🛑 收到 ${signal} 信号，开始优雅关闭...`);
        await app.stop()
        process.exit(0);
    })
}

process.on("uncaughtException", (error) => {
    console.error("❌ 未捕获的异常:", error);
})

process.on("unhandledRejection", (error) => {
    console.error("❌ 未处理的 Promise 拒绝:", error);
})

// 初始化数据库
await initializeDatabase();

// 启动 Web API
const server = app.listen(config.PORT, () => {
    console.log(`🌐 Sealos SNI Router Web Manager 启动在 http://0.0.0.0:${config.PORT}`);
    console.log(`📊 日志级别: ${config.NODE_ENV === "production" ? "error" : "info"}`);
})

// 启动 SNI Router
const SNI_PORT = 9443;
startSNIRouter(SNI_PORT).catch((err) => {
    console.error("❌ SNI Router 启动失败:", err);
    process.exit(1);
});

console.log(`✅ Sealos SNI Router 启动完成！`);
console.log(`   - Web 管理界面: http://localhost:${config.PORT}`);
console.log(`   - SNI 路由端口: ${SNI_PORT}`);
console.log(`   - 环境: ${config.NODE_ENV}`);
