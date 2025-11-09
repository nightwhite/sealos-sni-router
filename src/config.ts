import env from "env-var";

export const config = {
	NODE_ENV: env
		.get("NODE_ENV")
		.default("development")
		.asEnum(["production", "test", "development"]),

	PORT: env.get("PORT").default(3000).asPortNumber(),
	REDIS_URL: env.get("REDIS_URL").asString() || null,
	// 默认使用 /data/sni-router.db 路径，方便 K8s 挂载持久化卷
	DATABASE_URL: env.get("DATABASE_URL").default("sqlite:///data/sni-router.db").asString(),
}