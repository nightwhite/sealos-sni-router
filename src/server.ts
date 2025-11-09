import { Elysia, file } from "elysia"
import { config } from "./config.ts"
import { html } from "@elysiajs/html"
import { staticPlugin } from "@elysiajs/static"
import { logger } from "@bogeychan/elysia-logger"
import { servicesRouter } from "./routes/services.ts"

export const app = new Elysia()
  .use(
    logger({
      level: config.NODE_ENV === "production" ? "error" : "info",
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