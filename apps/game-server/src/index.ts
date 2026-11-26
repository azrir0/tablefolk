import http from "node:http";
import cors from "cors";
import express from "express";
import colyseus from "colyseus";
const { Server } = colyseus;
import { WebSocketTransport } from "@colyseus/ws-transport";
import { getDb } from "@tablefolk/db";
import { CafeRoom } from "./rooms/CafeRoom.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { HearthvaleRoom } from "./rooms/HearthvaleRoom.js";
import { VelvetMasqueRoom } from "./rooms/VelvetMasqueRoom.js";
import { createApiRouter } from "./routes/api.js";
import { assertProductionAuthConfig } from "./services/auth.js";

const PORT = Number(process.env.PORT || 2567);

function resolveAllowedOrigins(): boolean | string[] {
  const raw = process.env.WEB_ORIGIN?.trim();
  if (!raw) return true;
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

async function bootstrap() {
  // Refuse booting in production with default dev JWT secret
  assertProductionAuthConfig();

  // Initialize PostgreSQL (DATABASE_URL in cloud, or PGlite embedded locally)
  await getDb();

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: resolveAllowedOrigins(),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createApiRouter());

  const httpServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });

  gameServer.define("cafe", CafeRoom);
  gameServer.define("game", GameRoom);
  gameServer.define("hearthvale", HearthvaleRoom);
  gameServer.define("velvet-masque", VelvetMasqueRoom);

  await gameServer.listen(PORT, "0.0.0.0");
  console.log(`☕ TableFolk Game Server listening on http://0.0.0.0:${PORT}`);

  const shutdown = async () => {
    console.log("Shutting down TableFolk Game Server gracefully...");
    await gameServer.gracefullyShutdown(false);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

bootstrap().catch((err) => {
  console.error("Failed to start TableFolk Game Server:", err);
  process.exit(1);
});
