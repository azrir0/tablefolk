import crypto from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import {
  avatarConfigs,
  eq,
  getDb,
  playerProfiles,
  users,
} from "@tablefolk/db";
import {
  DEFAULT_AVATAR_CONFIG,
  generateRandomAvatarConfig,
  type AvatarConfig,
  type UserProfileDTO,
} from "@tablefolk/shared";

const scryptAsync = promisify(crypto.scrypt);

const DEV_FALLBACK_SECRET = "tablefolk-local-dev-jwt-secret-change-me";

export function assertProductionAuthConfig(): void {
  const configured =
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    process.env.TABLEFOLK_JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured === DEV_FALLBACK_SECRET || configured.length < 24) {
      throw new Error(
        "[TableFolk Security] In production, you must set TABLEFOLK_JWT_SECRET (or SUPABASE_JWT_SECRET) to a strong random string (24+ chars)."
      );
    }
  }
}

function getJwtSecretBytes(): Uint8Array {
  const secret =
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    process.env.TABLEFOLK_JWT_SECRET?.trim() ||
    DEV_FALLBACK_SECRET;
  return new TextEncoder().encode(secret);
}

export interface AuthTokenPayload {
  sub: string;
  isGuest: boolean;
  displayName: string;
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({
    isGuest: payload.isGuest,
    displayName: payload.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretBytes());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecretBytes());
  const sub = payload.sub;
  if (!sub) {
    throw new Error("Token missing subject");
  }
  return {
    sub,
    isGuest: Boolean(payload.isGuest),
    displayName:
      typeof payload.displayName === "string"
        ? payload.displayName
        : typeof payload.email === "string"
          ? payload.email.split("@")[0]!
          : "Explorer",
  };
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(keyHex, "hex");
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export async function getUserProfile(userId: string): Promise<UserProfileDTO | null> {
  const db = await getDb();
  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) return null;

  const [profileRow] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .limit(1);

  const [avatarRow] = await db
    .select()
    .from(avatarConfigs)
    .where(eq(avatarConfigs.userId, userId))
    .limit(1);

  return {
    userId: userRow.id,
    displayName: profileRow?.displayName ?? "Explorer",
    email: userRow.email ?? null,
    isGuest: userRow.isGuest,
    avatarConfig: avatarRow?.configJson ?? DEFAULT_AVATAR_CONFIG,
  };
}

export async function createGuestAccount(
  displayName: string,
  avatarConfig?: AvatarConfig
): Promise<{ token: string; profile: UserProfileDTO }> {
  const db = await getDb();
  const userId = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const cleanName = displayName.trim().slice(0, 24) || "Cozy Guest";
  const finalAvatar = avatarConfig ?? generateRandomAvatarConfig();

  await db.insert(users).values({
    id: userId,
    isGuest: true,
  });

  await db.insert(playerProfiles).values({
    userId,
    displayName: cleanName,
  });

  await db.insert(avatarConfigs).values({
    id: `av_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    configJson: finalAvatar,
    isActive: true,
  });

  const token = await signAuthToken({
    sub: userId,
    isGuest: true,
    displayName: cleanName,
  });

  return {
    token,
    profile: {
      userId,
      displayName: cleanName,
      email: null,
      isGuest: true,
      avatarConfig: finalAvatar,
    },
  };
}

export async function registerAccount(
  email: string,
  password: string,
  displayName: string,
  avatarConfig?: AvatarConfig
): Promise<{ token: string; profile: UserProfileDTO }> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing.length > 0) {
    throw new Error("An account with this email already exists.");
  }

  const userId = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const cleanName = displayName.trim().slice(0, 24) || normalizedEmail.split("@")[0]!;
  const passwordHash = await hashPassword(password);
  const finalAvatar = avatarConfig ?? generateRandomAvatarConfig();

  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash,
    isGuest: false,
  });

  await db.insert(playerProfiles).values({
    userId,
    displayName: cleanName,
  });

  await db.insert(avatarConfigs).values({
    id: `av_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    configJson: finalAvatar,
    isActive: true,
  });

  const token = await signAuthToken({
    sub: userId,
    isGuest: false,
    displayName: cleanName,
  });

  return {
    token,
    profile: {
      userId,
      displayName: cleanName,
      email: normalizedEmail,
      isGuest: false,
      avatarConfig: finalAvatar,
    },
  };
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ token: string; profile: UserProfileDTO }> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (!userRow || !userRow.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  const ok = await verifyPassword(password, userRow.passwordHash);
  if (!ok) {
    throw new Error("Invalid email or password.");
  }

  const profile = await getUserProfile(userRow.id);
  if (!profile) {
    throw new Error("Profile not found.");
  }

  const token = await signAuthToken({
    sub: userRow.id,
    isGuest: false,
    displayName: profile.displayName,
  });

  return { token, profile };
}

export async function upgradeGuestToAccount(
  userId: string,
  email: string,
  password: string
): Promise<{ token: string; profile: UserProfileDTO }> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing.length > 0) {
    throw new Error("That email is already registered.");
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ email: normalizedEmail, passwordHash, isGuest: false })
    .where(eq(users.id, userId));

  const profile = await getUserProfile(userId);
  if (!profile) throw new Error("User not found.");

  const token = await signAuthToken({
    sub: userId,
    isGuest: false,
    displayName: profile.displayName,
  });

  return { token, profile };
}

export async function updateUserProfileAndAvatar(
  userId: string,
  updates: { displayName?: string; avatarConfig?: AvatarConfig }
): Promise<UserProfileDTO> {
  const db = await getDb();
  if (updates.displayName) {
    await db
      .update(playerProfiles)
      .set({ displayName: updates.displayName.trim().slice(0, 24), updatedAt: new Date() })
      .where(eq(playerProfiles.userId, userId));
  }

  if (updates.avatarConfig) {
    const existing = await db
      .select()
      .from(avatarConfigs)
      .where(eq(avatarConfigs.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(avatarConfigs)
        .set({ configJson: updates.avatarConfig, updatedAt: new Date() })
        .where(eq(avatarConfigs.id, existing[0]!.id));
    } else {
      await db.insert(avatarConfigs).values({
        id: `av_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        userId,
        configJson: updates.avatarConfig,
        isActive: true,
      });
    }
  }

  const profile = await getUserProfile(userId);
  if (!profile) throw new Error("Profile not found.");
  return profile;
}
