import { randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "t1_workspace_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface WorkspaceSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  githubAccessToken?: string;
  githubUser?: { login: string; name?: string; avatarUrl?: string };
  googleAccessToken?: string;
  googleExpiresAt?: string;
  googleUser?: { email: string; name?: string; picture?: string };
  googleMapsApiKey?: string;
  openRouterApiKey?: string;
  tests: {
    github: boolean;
    gmail: boolean;
    drive: boolean;
    googleMaps: boolean;
    openRouter: boolean;
    proxy: boolean;
    proxyDetail?: string;
    testedAt?: string;
  };
}

const sessions = new Map<string, WorkspaceSession>();
const oauthStates = new Map<string, { sessionId: string; provider: "github" | "google"; expiresAt: number }>();

export function getWorkspaceSession(req: Request, res: Response): WorkspaceSession {
  purge();
  const existingId = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
  const existing = existingId ? sessions.get(existingId) : undefined;
  if (existing) return existing;

  const now = Date.now();
  const session: WorkspaceSession = {
    id: `workspace-${randomUUID()}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    tests: {
      github: false,
      gmail: false,
      drive: false,
      googleMaps: false,
      openRouter: false,
      proxy: false,
    },
  };
  sessions.set(session.id, session);
  setSessionCookie(res, session.id);
  return session;
}

export function findWorkspaceSession(req: Request): WorkspaceSession | undefined {
  purge();
  const id = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
  return id ? sessions.get(id) : undefined;
}

export function clearWorkspaceSession(req: Request, res: Response): void {
  const id = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
  if (id) sessions.delete(id);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function createOAuthState(session: WorkspaceSession, provider: "github" | "google"): string {
  purge();
  const state = randomBytes(32).toString("base64url");
  oauthStates.set(state, { sessionId: session.id, provider, expiresAt: Date.now() + 10 * 60 * 1000 });
  return state;
}

export function consumeOAuthState(state: string, provider: "github" | "google"): WorkspaceSession {
  purge();
  const record = oauthStates.get(state);
  oauthStates.delete(state);
  if (!record || record.provider !== provider || record.expiresAt <= Date.now()) {
    throw new Error("OAuth state is invalid or expired.");
  }
  const session = sessions.get(record.sessionId);
  if (!session) throw new Error("Workspace session expired during OAuth.");
  return session;
}

export function publicWorkspaceStatus(session: WorkspaceSession) {
  const checks = session.tests;
  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    github: {
      connected: Boolean(session.githubAccessToken && session.githubUser),
      user: session.githubUser,
      tested: checks.github,
    },
    google: {
      connected: Boolean(session.googleAccessToken && session.googleUser),
      user: session.googleUser,
      gmailTested: checks.gmail,
      driveTested: checks.drive,
    },
    googleMaps: { configured: Boolean(session.googleMapsApiKey), tested: checks.googleMaps },
    openRouter: { configured: Boolean(session.openRouterApiKey), tested: checks.openRouter },
    proxy: { tested: checks.proxy, detail: checks.proxyDetail },
    testedAt: checks.testedAt,
    ready: checks.github && checks.gmail && checks.drive && checks.googleMaps && checks.openRouter && checks.proxy,
  };
}

export function workspaceRedirectBase(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = firstHeader(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol || "http";
  const host = firstHeader(req.headers["x-forwarded-host"]) || req.get("host");
  if (!host) throw new Error("Cannot determine public callback URL. Configure PUBLIC_BASE_URL.");
  return `${protocol}://${host}`;
}

function setSessionCookie(res: Response, id: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function parseCookies(value: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const part of value.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName || rest.length === 0) continue;
    try { output[rawName] = decodeURIComponent(rest.join("=")); }
    catch { output[rawName] = rest.join("="); }
  }
  return output;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function purge(): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (Date.parse(session.expiresAt) <= now) sessions.delete(id);
  for (const [state, record] of oauthStates) if (record.expiresAt <= now) oauthStates.delete(state);
}
