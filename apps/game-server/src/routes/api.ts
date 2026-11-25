import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import colyseus from "colyseus";
const { matchMaker } = colyseus;
import { z } from "zod";
import {
  eq,
  gameCatalogue,
  gameTutorials,
  getDb,
  playerReports,
  privateCafes,
} from "@tablefolk/db";
import {
  AvatarConfigSchema,
  ProfileUpdateAvatarPayloadSchema,
  type CafeInstanceSummaryDTO,
  type GameCatalogueItemDTO,
  type GameTutorialDTO,
} from "@tablefolk/shared";
import {
  createGuestAccount,
  getUserProfile,
  loginAccount,
  registerAccount,
  updateUserProfileAndAvatar,
  upgradeGuestToAccount,
  verifyAuthToken,
} from "../services/auth.js";
import {
  getActiveGameForUser,
  lookupPrivateCafeRoom,
} from "../services/roomRegistry.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  message: "Too many sign-in attempts. Please wait a few minutes.",
});

const privateCafeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many private cafés created recently. Please wait a moment.",
});

const reportLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

const GuestAuthSchema = z.object({
  displayName: z.string().trim().min(2).max(24),
  avatarConfig: AvatarConfigSchema.optional(),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  displayName: z.string().trim().min(2).max(24),
  avatarConfig: AvatarConfigSchema.optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UpgradeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const PrivateCafeCreateSchema = z.object({
  name: z.string().trim().min(2).max(40).default("My Private Café"),
  maxPlayers: z.number().int().min(4).max(30).default(12),
});

const ReportSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(3).max(300),
  context: z.record(z.unknown()).optional(),
});

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Missing Authorization Bearer token." });
    return null;
  }
  try {
    const payload = await verifyAuthToken(token);
    return payload.sub;
  } catch {
    res.status(401).json({ error: "Invalid or expired session token." });
    return null;
  }
}

export function createApiRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tablefolk-game-server", timestamp: Date.now() });
  });

  // --- Authentication ---

  router.use("/auth", authLimiter);
  router.use("/cafes/private", privateCafeLimiter);
  router.use("/reports", reportLimiter);

  router.post("/auth/guest", async (req, res) => {
    const parsed = GuestAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please enter a nickname (2–24 characters)." });
      return;
    }
    try {
      const result = await createGuestAccount(parsed.data.displayName, parsed.data.avatarConfig);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/register", async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Provide a valid email, password (6+ chars), and nickname." });
      return;
    }
    try {
      const result = await registerAccount(
        parsed.data.email,
        parsed.data.password,
        parsed.data.displayName,
        parsed.data.avatarConfig
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Provide email and password." });
      return;
    }
    try {
      const result = await loginAccount(parsed.data.email, parsed.data.password);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/upgrade", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const parsed = UpgradeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Provide valid email and 6+ character password." });
      return;
    }
    try {
      const result = await upgradeGuestToAccount(
        userId,
        parsed.data.email,
        parsed.data.password
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --- Profile & Avatar ---

  router.get("/me", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const profile = await getUserProfile(userId);
    if (!profile) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    res.json({ profile });
  });

  router.get("/me/active-game", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    res.json({ activeGame: getActiveGameForUser(userId) });
  });

  router.patch("/me/avatar", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const parsed = ProfileUpdateAvatarPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid avatar configuration." });
      return;
    }
    const profile = await updateUserProfileAndAvatar(userId, parsed.data);
    res.json({ profile });
  });

  // --- Game Catalogue & DB-Driven Tutorials ---

  router.get("/games", async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(gameCatalogue);
    const items: GameCatalogueItemDTO[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      tagline: r.tagline,
      description: r.description,
      category: r.category,
      minPlayers: r.minPlayers,
      maxPlayers: r.maxPlayers,
      estimatedMinutes: r.estimatedMinutes,
      difficulty: r.difficulty as "Easy" | "Medium" | "Strategic",
      coverTheme: r.coverTheme,
      isAvailable: r.isAvailable,
      tutorialAvailable: r.tutorialAvailable,
    }));
    res.json({ games: items });
  });

  router.get("/games/:slug/tutorial", async (req, res) => {
    const db = await getDb();
    const slug = req.params.slug;
    const [game] = await db
      .select()
      .from(gameCatalogue)
      .where(eq(gameCatalogue.slug, slug))
      .limit(1);
    const [tut] = await db
      .select()
      .from(gameTutorials)
      .where(eq(gameTutorials.gameSlug, slug))
      .limit(1);

    if (!game || !tut) {
      res.status(404).json({ error: "Tutorial not found." });
      return;
    }

    const dto: GameTutorialDTO = {
      gameSlug: game.slug,
      title: game.title,
      summary: tut.summary,
      rulesMarkdown: tut.rulesMarkdown,
      cardReference: tut.cardReferenceJson,
      faq: tut.faqJson,
      videoUrl: tut.videoUrl ?? null,
    };
    res.json({ tutorial: dto });
  });

  // --- Public & Private Cafés ---

  router.get("/cafes", async (_req, res) => {
    const rooms = await matchMaker.query({ name: "cafe", private: false });
    const cafes: CafeInstanceSummaryDTO[] = rooms.map((r) => ({
      roomId: r.roomId,
      name: (r.metadata?.cafeName as string) || "Sunlit Oak Café",
      instanceLabel: (r.metadata?.instanceLabel as string) || "Public",
      isPrivate: false,
      playerCount: r.clients,
      maxPlayers: r.maxClients,
    }));
    res.json({ cafes });
  });

  router.post("/cafes/private", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const parsed = PrivateCafeCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid private café settings." });
      return;
    }

    const accessCode = crypto.randomBytes(3).toString("hex").toUpperCase();
    const room = await matchMaker.createRoom("cafe", {
      isPrivate: true,
      cafeName: parsed.data.name,
      accessCode,
      ownerUserId: userId,
      maxPlayers: parsed.data.maxPlayers,
    });

    const db = await getDb();
    await db.insert(privateCafes).values({
      id: room.roomId,
      ownerUserId: userId,
      name: parsed.data.name,
      accessCode,
      maxPlayers: parsed.data.maxPlayers,
      status: "ACTIVE",
    });

    res.json({
      roomId: room.roomId,
      name: parsed.data.name,
      accessCode,
    });
  });

  router.post("/cafes/resolve-code", (req, res) => {
    const code = String(req.body?.accessCode || "")
      .trim()
      .toUpperCase();
    if (!code) {
      res.status(400).json({ error: "Enter an access code." });
      return;
    }
    const roomId = lookupPrivateCafeRoom(code);
    if (!roomId) {
      res.status(404).json({ error: "No active private café found with that code." });
      return;
    }
    res.json({ roomId, accessCode: code });
  });

  // --- Social Moderation (MOD-01) ---

  router.post("/reports", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Provide target and reason." });
      return;
    }
    const db = await getDb();
    await db.insert(playerReports).values({
      id: `rep_${crypto.randomUUID().slice(0, 12)}`,
      reporterId: userId,
      targetId: parsed.data.targetUserId,
      reason: parsed.data.reason,
      contextJson: parsed.data.context ?? {},
    });
    res.json({ ok: true });
  });

  return router;
}
