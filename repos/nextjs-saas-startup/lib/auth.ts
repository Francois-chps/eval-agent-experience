import { cookies } from "next/headers";
import { createSession, deleteSession, findSession, findUserById, type User } from "./db";

const SESSION_COOKIE = "tablo_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function startSession(userId: string): Promise<void> {
  const session = await createSession(userId, SESSION_TTL_MS);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await findSession(sessionId);
  if (!session) return null;

  return (await findUserById(session.userId)) ?? null;
}
