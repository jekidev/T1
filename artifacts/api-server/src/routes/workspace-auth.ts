import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  clearWorkspaceSession,
  consumeOAuthState,
  createOAuthState,
  findWorkspaceSession,
  getWorkspaceSession,
  publicWorkspaceStatus,
  workspaceRedirectBase,
  type WorkspaceSession,
} from "../lib/workspace-session";

const router: IRouter = Router();
const GITHUB_API = "https://api.github.com";

router.get("/workspace/auth/status", (req, res): void => {
  res.json(publicWorkspaceStatus(getWorkspaceSession(req, res)));
});

router.post("/workspace/auth/credentials", (req, res): void => {
  try {
    const body = z.object({
      openRouterApiKey: z.string().trim().min(20).max(500).optional(),
      googleMapsApiKey: z.string().trim().min(20).max(500).optional(),
    }).parse(req.body ?? {});
    const session = getWorkspaceSession(req, res);
    if (body.openRouterApiKey) {
      session.openRouterApiKey = body.openRouterApiKey;
      session.tests.openRouter = false;
    }
    if (body.googleMapsApiKey) {
      session.googleMapsApiKey = body.googleMapsApiKey;
      session.tests.googleMaps = false;
    }
    res.json(publicWorkspaceStatus(session));
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/workspace/auth/logout", (req, res): void => {
  clearWorkspaceSession(req, res);
  res.json({ loggedOut: true });
});

router.get("/workspace/auth/github/start", (req, res): void => {
  try {
    const clientId = requiredEnv("GITHUB_OAUTH_CLIENT_ID");
    const session = getWorkspaceSession(req, res);
    const state = createOAuthState(session, "github");
    const callback = `${workspaceRedirectBase(req)}/api/workspace/auth/github/callback`;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("scope", "read:user repo public_repo");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  } catch (error) {
    sendError(res, error, 503);
  }
});

router.get("/workspace/auth/github/callback", async (req, res): Promise<void> => {
  try {
    const code = z.string().min(1).parse(req.query.code);
    const state = z.string().min(1).parse(req.query.state);
    const session = consumeOAuthState(state, "github");
    const tokenResponse = await fetchJson("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: requiredEnv("GITHUB_OAUTH_CLIENT_ID"),
        client_secret: requiredEnv("GITHUB_OAUTH_CLIENT_SECRET"),
        code,
      }),
    });
    const token = stringField(tokenResponse, "access_token");
    const user = await githubJson(token, "/user");
    session.githubAccessToken = token;
    session.githubUser = {
      login: stringField(user, "login"),
      ...(optionalString(user, "name") ? { name: optionalString(user, "name") } : {}),
      ...(optionalString(user, "avatar_url") ? { avatarUrl: optionalString(user, "avatar_url") } : {}),
    };
    session.tests.github = true;
    res.redirect(`${workspaceRedirectBase(req)}/workspace?connected=github`);
  } catch (error) {
    res.redirect(`${workspaceRedirectBase(req)}/workspace?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
});

router.get("/workspace/auth/google/start", (req, res): void => {
  try {
    const clientId = requiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const session = getWorkspaceSession(req, res);
    const state = createOAuthState(session, "google");
    const callback = `${workspaceRedirectBase(req)}/api/workspace/auth/google/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ].join(" "));
    res.redirect(url.toString());
  } catch (error) {
    sendError(res, error, 503);
  }
});

router.get("/workspace/auth/google/callback", async (req, res): Promise<void> => {
  try {
    const code = z.string().min(1).parse(req.query.code);
    const state = z.string().min(1).parse(req.query.state);
    const session = consumeOAuthState(state, "google");
    const callback = `${workspaceRedirectBase(req)}/api/workspace/auth/google/callback`;
    const body = new URLSearchParams({
      client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: callback,
    });
    const tokenResponse = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const token = stringField(tokenResponse, "access_token");
    const expiresIn = Number((tokenResponse as Record<string, unknown>).expires_in ?? 3600);
    const user = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    session.googleAccessToken = token;
    session.googleExpiresAt = new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString();
    session.googleUser = {
      email: stringField(user, "email"),
      ...(optionalString(user, "name") ? { name: optionalString(user, "name") } : {}),
      ...(optionalString(user, "picture") ? { picture: optionalString(user, "picture") } : {}),
    };
    session.tests.gmail = false;
    session.tests.drive = false;
    res.redirect(`${workspaceRedirectBase(req)}/workspace?connected=google`);
  } catch (error) {
    res.redirect(`${workspaceRedirectBase(req)}/workspace?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
});

router.post("/workspace/auth/test", async (req, res): Promise<void> => {
  const session = getWorkspaceSession(req, res);
  try {
    const results = await testWorkspaceConnections(session);
    res.json({ ...publicWorkspaceStatus(session), results });
  } catch (error) {
    sendError(res, error, 502);
  }
});

router.get("/workspace/github/repos", async (req, res): Promise<void> => {
  try {
    const session = requireWorkspace(req);
    const token = requireGithub(session);
    const scope = z.enum(["owned", "starred"]).default("owned").parse(req.query.scope);
    const endpoint = scope === "starred"
      ? "/user/starred?per_page=100&sort=updated"
      : "/user/repos?per_page=100&sort=updated&affiliation=owner";
    const data = await githubJson(token, endpoint);
    if (!Array.isArray(data)) throw new Error("GitHub returned an invalid repository list.");
    res.json({ repos: data.map(normalizeRepo) });
  } catch (error) {
    sendError(res, error, 401);
  }
});

router.post("/workspace/github/repos", async (req, res): Promise<void> => {
  try {
    const session = requireWorkspace(req);
    const token = requireGithub(session);
    const body = z.object({
      name: z.string().trim().regex(/^[A-Za-z0-9._-]+$/).min(1).max(100),
      description: z.string().trim().max(350).default(""),
      private: z.boolean().default(true),
      autoInit: z.boolean().default(true),
    }).parse(req.body ?? {});
    const created = await githubJson(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        private: body.private,
        auto_init: body.autoInit,
      }),
    });
    res.status(201).json({ repo: normalizeRepo(created) });
  } catch (error) {
    sendError(res, error, 400);
  }
});

async function testWorkspaceConnections(session: WorkspaceSession) {
  const results: Record<string, { ok: boolean; detail: string }> = {};

  results.github = await attempt(async () => {
    const token = requireGithub(session);
    const user = await githubJson(token, "/user");
    session.githubUser = {
      login: stringField(user, "login"),
      ...(optionalString(user, "name") ? { name: optionalString(user, "name") } : {}),
      ...(optionalString(user, "avatar_url") ? { avatarUrl: optionalString(user, "avatar_url") } : {}),
    };
    session.tests.github = true;
    return `Authenticated as ${session.githubUser.login}`;
  }, () => { session.tests.github = false; });

  results.gmail = await attempt(async () => {
    const token = requireGoogle(session);
    const profile = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token}` } });
    session.tests.gmail = true;
    return `Gmail profile ${optionalString(profile, "emailAddress") ?? session.googleUser?.email ?? "verified"}`;
  }, () => { session.tests.gmail = false; });

  results.drive = await attempt(async () => {
    const token = requireGoogle(session);
    await fetchJson("https://www.googleapis.com/drive/v3/about?fields=user", { headers: { Authorization: `Bearer ${token}` } });
    session.tests.drive = true;
    return "Google Drive metadata access verified";
  }, () => { session.tests.drive = false; });

  results.googleMaps = await attempt(async () => {
    if (!session.googleMapsApiKey) throw new Error("Google Maps API key is missing.");
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", "Copenhagen, Denmark");
    url.searchParams.set("key", session.googleMapsApiKey);
    const response = await fetchJson(url.toString());
    const status = optionalString(response, "status");
    if (status !== "OK" && status !== "ZERO_RESULTS") throw new Error(`Google Maps returned ${status ?? "unknown status"}.`);
    session.tests.googleMaps = true;
    return "Google Maps API verified";
  }, () => { session.tests.googleMaps = false; });

  results.openRouter = await attempt(async () => {
    if (!session.openRouterApiKey) throw new Error("OpenRouter API key is missing.");
    const response = await fetchJson("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${session.openRouterApiKey}` },
    });
    const count = Array.isArray((response as Record<string, unknown>).data) ? ((response as Record<string, unknown>).data as unknown[]).length : 0;
    session.tests.openRouter = true;
    return `OpenRouter verified (${count} models visible)`;
  }, () => { session.tests.openRouter = false; });

  results.proxy = await attempt(async () => {
    const response = await fetchJson("https://am.i.mullvad.net/json");
    const isMullvad = Boolean((response as Record<string, unknown>).mullvad_exit_ip);
    const ip = optionalString(response, "ip") ?? "unknown IP";
    const city = optionalString(response, "city") ?? optionalString(response, "country") ?? "unknown location";
    if (!isMullvad) throw new Error(`Current server egress ${ip} is not reported as a Mullvad exit.`);
    session.tests.proxy = true;
    session.tests.proxyDetail = `${ip} · ${city} · Mullvad exit verified. Multihop cannot be proven from the exit endpoint alone.`;
    return session.tests.proxyDetail;
  }, () => {
    session.tests.proxy = false;
    session.tests.proxyDetail = undefined;
  });

  session.tests.testedAt = new Date().toISOString();
  return results;
}

function requireWorkspace(req: Request): WorkspaceSession {
  const session = findWorkspaceSession(req);
  if (!session) throw new Error("Workspace session is missing or expired.");
  return session;
}

function requireGithub(session: WorkspaceSession): string {
  if (!session.githubAccessToken) throw new Error("GitHub is not connected.");
  return session.githubAccessToken;
}

function requireGoogle(session: WorkspaceSession): string {
  if (!session.googleAccessToken) throw new Error("Google is not connected.");
  if (session.googleExpiresAt && Date.parse(session.googleExpiresAt) <= Date.now()) throw new Error("Google OAuth access expired. Reconnect Google.");
  return session.googleAccessToken;
}

async function githubJson(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  return fetchJson(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "T1-Workspace/1.0",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    const text = await response.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; }
    catch { body = { text: text.slice(0, 1000) }; }
    if (!response.ok) {
      const message = optionalString(body, "message") ?? optionalString(body, "error_description") ?? `HTTP ${response.status}`;
      throw new Error(message);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function attempt(operation: () => Promise<string>, onFailure: () => void) {
  try { return { ok: true, detail: await operation() }; }
  catch (error) { onFailure(); return { ok: false, detail: error instanceof Error ? error.message : String(error) }; }
}

function normalizeRepo(value: unknown) {
  const repo = value as Record<string, unknown>;
  const owner = repo.owner && typeof repo.owner === "object" ? repo.owner as Record<string, unknown> : {};
  return {
    id: String(repo.id ?? ""),
    name: String(repo.name ?? ""),
    fullName: String(repo.full_name ?? ""),
    description: optionalString(repo, "description") ?? "",
    private: Boolean(repo.private),
    htmlUrl: String(repo.html_url ?? ""),
    cloneUrl: String(repo.clone_url ?? ""),
    defaultBranch: String(repo.default_branch ?? "main"),
    updatedAt: String(repo.updated_at ?? ""),
    stars: Number(repo.stargazers_count ?? 0),
    owner: String(owner.login ?? ""),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function stringField(value: unknown, key: string): string {
  const result = optionalString(value, key);
  if (!result) throw new Error(`Provider response is missing ${key}.`);
  return result;
}

function optionalString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

function sendError(res: Response, error: unknown, status: number): void {
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
}

export default router;
