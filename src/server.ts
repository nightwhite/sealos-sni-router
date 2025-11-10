import { Elysia, file } from "elysia"
import { config } from "./config.ts"
import { html } from "@elysiajs/html"
import { staticPlugin } from "@elysiajs/static"
import { logger } from "@bogeychan/elysia-logger"
import { servicesRouter } from "./routes/services.ts"

export const app = new Elysia()
  .use(
    logger({
      level: "info",  // 始终使用 info 级别，便于调试
    })
  )
  .use(html())
  .get("/", () => file("./public/index.html"))
  .use(
    staticPlugin({
      prefix: "",
      assets: "public",
    })
  )
  .use(servicesRouter)
  .get("/health", () => {
    return { status: "ok" }
  })

export type ElysiaApp = typeof app