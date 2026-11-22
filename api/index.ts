import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AuthRole = 'admin' | 'master';

interface AppDataPayload {
  banner: Record<string, unknown>;
  siteCopy: Record<string, unknown>;
  adminPanelConfig: {
    allowedTabs?: string[];
    allowResetDefaults?: boolean;
    [key: string]: unknown;
  };
  teams: unknown[];
  announcements: unknown[];
  categories: unknown[];
  leaderboards: unknown[];
  lastUpdated: string;
  [key: string]: unknown;
}

const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CKD76classmeeting';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'CKD76classmeetingMASTER';
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'ckd76-data')
  : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const AUTH_PATH = path.resolve(DATA_DIR, 'auth.json');

const MINIMAL_FALLBACK_DATA: AppDataPayload = {
  banner: {
    heroTitle: 'CKD 76',
    editionLabel: 'CKD 76 Class Meeting',
    headline: 'Five Days of Friendly Rivalry, Craft & Camaraderie.',
    subheadline: 'Daily event rundown, live knockout brackets, match results, and class standings.',
    datesLabel: '19 – 23 NOVEMBER 2026 · CENTRAL COURTYARD · CKD 76',
    locationLabel: 'Central Courtyard, Maple Gymnasium & Main Auditorium',
    heroImageUrl: '',
  },
  siteCopy: {
    navHomeLabel: 'HOME',
    navAnnouncementsLabel: 'RUNDOWN',
    navCompetitionsLabel: 'MATCH RESULT',
    navLeaderboardLabel: 'LEADERBOARD',
    navSettingsLabel: 'SETTINGS',
  },
  adminPanelConfig: {
    panelTitle: 'Tournament & Rundown Administration',
    panelSubtitle: 'CKD 76 Organizer Console',
    lockPromptTitle: 'CKD Committee Access',
    lockPromptMessage: 'Enter organizer password to manage brackets & rundown',
    allowedTabs: ['site', 'announcements', 'brackets', 'leaderboards', 'teams'],
    allowResetDefaults: true,
    allowDeleteItems: true,
  },
  teams: [],
  announcements: [],
  categories: [],
  leaderboards: [],
  lastUpdated: new Date().toISOString(),
};

let cachedInitialData: AppDataPayload | null = null;

function loadInitialData(): AppDataPayload {
  if (cachedInitialData) {
    return structuredClone(cachedInitialData);
  }
  const candidates = [
    path.resolve(process.cwd(), 'src/data/initialData.json'),
    path.resolve(__dirname, '../src/data/initialData.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as AppDataPayload;
        if (parsed && Array.isArray(parsed.categories)) {
          cachedInitialData = parsed;
          return structuredClone(parsed);
        }
      }
    } catch (err) {
      console.error(`Failed loading initialData.json from ${filePath}:`, err);
    }
  }
  return structuredClone(MINIMAL_FALLBACK_DATA);
}

interface AuthStoreRecord {
  adminSalt: string;
  adminHash: string;
  passwordVersion: number;
  sessionSecret?: string;
}

interface CloudAuthCache {
  fetchedAt: number;
  record: { adminSalt: string; adminHash: string; passwordVersion: number } | null;
}

let cachedEnvelopeKey: Buffer | null = null;
let cloudAuthCache: CloudAuthCache = { fetchedAt: 0, record: null };

function loadFirebaseAppletConfig(): { projectId: string; databaseId: string } | null {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '../firebase-applet-config.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
          projectId?: string;
          firestoreDatabaseId?: string;
        };
        if (parsed.projectId && parsed.projectId !== 'remixed-project-id') {
          return {
            projectId: parsed.projectId,
            databaseId:
              parsed.firestoreDatabaseId &&
              parsed.firestoreDatabaseId !== '(default)' &&
              parsed.firestoreDatabaseId !== 'remixed-firestore-database-id'
                ? parsed.firestoreDatabaseId
                : '(default)',
          };
        }
      }
    } catch {
      // ignore invalid config read
    }
  }
  return null;
}

function getEnvelopeKey(): Buffer {
  if (cachedEnvelopeKey) return cachedEnvelopeKey;
  const envelopeSecret = process.env.SESSION_SECRET || MASTER_PASSWORD;
  cachedEnvelopeKey = crypto.scryptSync(envelopeSecret, 'ckd76-admin-auth-envelope-v1', 32);
  return cachedEnvelopeKey;
}

function sealAuthEnvelope(record: {
  adminSalt: string;
  adminHash: string;
  passwordVersion: number;
}): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEnvelopeKey(), iv);
  const plaintext = JSON.stringify({
    v: 1,
    s: record.adminSalt,
    h: record.adminHash,
    pv: record.passwordVersion,
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

function unsealAuthEnvelope(
  envelope: string
): { adminSalt: string; adminHash: string; passwordVersion: number } | null {
  if (!envelope || typeof envelope !== 'string') return null;
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEnvelopeKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
    const parsed = JSON.parse(decrypted) as { v?: number; s?: string; h?: string; pv?: number };
    if (
      parsed.v === 1 &&
      typeof parsed.s === 'string' &&
      typeof parsed.h === 'string' &&
      typeof parsed.pv === 'number' &&
      Number.isInteger(parsed.pv) &&
      parsed.pv >= 2
    ) {
      return {
        adminSalt: parsed.s,
        adminHash: parsed.h,
        passwordVersion: parsed.pv,
      };
    }
    return null;
  } catch {
    return null;
  }
}

interface SessionTokenPayload {
  role: AuthRole;
  pwdVersion: number;
  exp: number;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { salt: usedSalt, hash: derived };
}

function verifyHash(password: string, salt: string, expectedHashHex: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function timingSafeTextEqual(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr, 'utf-8');
  const b = Buffer.from(bStr, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function writeAuthStore(record: AuthStoreRecord): void {
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_PATH, JSON.stringify(record, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write auth store:', err);
  }
}

function readAuthStore(): AuthStoreRecord {
  try {
    if (fs.existsSync(AUTH_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8')) as Partial<AuthStoreRecord>;
      if (parsed.adminSalt && parsed.adminHash && typeof parsed.passwordVersion === 'number') {
        return {
          adminSalt: parsed.adminSalt,
          adminHash: parsed.adminHash,
          passwordVersion: parsed.passwordVersion,
          sessionSecret: parsed.sessionSecret,
        };
      }
    }
  } catch (err) {
    console.error('Failed to read auth store, initializing default:', err);
  }
  const { salt, hash } = hashPassword(INITIAL_ADMIN_PASSWORD);
  const initial: AuthStoreRecord = {
    adminSalt: salt,
    adminHash: hash,
    passwordVersion: 1,
    sessionSecret: EPHEMERAL_SECRET,
  };
  writeAuthStore(initial);
  return initial;
}

function getSigningSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  const auth = readAuthStore();
  if (auth.sessionSecret) {
    return auth.sessionSecret;
  }
  const updated: AuthStoreRecord = { ...auth, sessionSecret: EPHEMERAL_SECRET };
  writeAuthStore(updated);
  return EPHEMERAL_SECRET;
}

function signSessionToken(role: AuthRole, pwdVersion: number): string {
  const payload: SessionTokenPayload = {
    role,
    pwdVersion,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

async function fetchCloudAdminAuth(
  useCache: boolean
): Promise<{ adminSalt: string; adminHash: string; passwordVersion: number } | null> {
  const now = Date.now();
  if (useCache && now - cloudAuthCache.fetchedAt < 2000) {
    return cloudAuthCache.record;
  }

  const fbConfig = loadFirebaseAppletConfig();
  if (!fbConfig) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    fbConfig.projectId
  )}/databases/${encodeURIComponent(fbConfig.databaseId)}/documents/adminAuth/current`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      if (res.status === 404) {
        cloudAuthCache = { fetchedAt: now, record: null };
      }
      return cloudAuthCache.record;
    }
    const payload = (await res.json()) as {
      fields?: {
        authEnvelope?: { stringValue?: string };
      };
    };
    const envelope = payload?.fields?.authEnvelope?.stringValue;
    if (!envelope) return null;
    const unsealed = unsealAuthEnvelope(envelope);
    if (unsealed) {
      cloudAuthCache = { fetchedAt: now, record: unsealed };
      return unsealed;
    }
    return null;
  } catch {
    return cloudAuthCache.record;
  }
}

async function getEffectiveAuthStore(options?: { freshCloud?: boolean }): Promise<AuthStoreRecord> {
  const localAuth = readAuthStore();
  const cloudRecord = await fetchCloudAdminAuth(!options?.freshCloud);
  if (cloudRecord && cloudRecord.passwordVersion > localAuth.passwordVersion) {
    const synced: AuthStoreRecord = {
      ...localAuth,
      adminSalt: cloudRecord.adminSalt,
      adminHash: cloudRecord.adminHash,
      passwordVersion: cloudRecord.passwordVersion,
    };
    writeAuthStore(synced);
    return synced;
  }
  return localAuth;
}

async function verifyBearerToken(req: Request): Promise<AuthRole | null> {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  if (!timingSafeTextEqual(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as SessionTokenPayload;

    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    if (payload.role !== 'admin' && payload.role !== 'master') {
      return null;
    }
    if (payload.role === 'admin') {
      const auth = await getEffectiveAuthStore({ freshCloud: false });
      if (payload.pwdVersion !== auth.passwordVersion) {
        return null;
      }
    }
    return payload.role;
  } catch {
    return null;
  }
}

function readStore(): AppDataPayload {
  const defaults = loadInitialData();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppDataPayload>;
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.announcements)) {
        return {
          ...defaults,
          ...parsed,
          banner: {
            ...defaults.banner,
            ...(parsed.banner || {}),
          },
          siteCopy: {
            ...defaults.siteCopy,
            ...(parsed.siteCopy || {}),
          },
          adminPanelConfig: {
            ...defaults.adminPanelConfig,
            ...(parsed.adminPanelConfig || {}),
            allowedTabs: Array.isArray(parsed.adminPanelConfig?.allowedTabs)
              ? parsed.adminPanelConfig.allowedTabs
              : defaults.adminPanelConfig.allowedTabs,
          },
        };
      }
    }
  } catch (err) {
    console.error('Failed to read store.json, falling back to default:', err);
  }
  return defaults;
}

function writeStore(nextState: AppDataPayload): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(nextState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write store.json:', err);
  }
}

export function createApiApp(options?: { mountRootRoutes?: boolean }): Express {
  const app = express();

  // Preserve pre-parsed req.body on Vercel serverless runtime before express.json()
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      (req as Request & { _body?: boolean })._body = true;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));

  const router = express.Router();

  router.get('/state', (_req: Request, res: Response) => {
    const state = readStore();
    res.json(state);
  });

  router.post('/verify-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const submitted = typeof body?.password === 'string' ? body.password : '';
      const requestedMode = body?.mode === 'master' ? 'master' : 'admin';

      if (!submitted) {
        res.status(401).json({ ok: false, error: 'Password is required.' });
        return;
      }

      if (requestedMode === 'master') {
        if (timingSafeTextEqual(submitted, MASTER_PASSWORD)) {
          const token = signSessionToken('master', 0);
          res.json({ ok: true, role: 'master', token, passwordVersion: 0 });
          return;
        }
        res.status(401).json({ ok: false, error: 'Incorrect Master password.' });
        return;
      }

      const auth = await getEffectiveAuthStore({ freshCloud: true });
      const matchesEnvAdmin =
        auth.passwordVersion === 1 &&
        Boolean(process.env.ADMIN_PASSWORD) &&
        timingSafeTextEqual(submitted, process.env.ADMIN_PASSWORD as string);
      const matchesStoredAdmin = verifyHash(submitted, auth.adminSalt, auth.adminHash);

      if (matchesEnvAdmin || matchesStoredAdmin) {
        const token = signSessionToken('admin', auth.passwordVersion);
        res.json({ ok: true, role: 'admin', token, passwordVersion: auth.passwordVersion });
        return;
      }

      res.status(401).json({ ok: false, error: 'Incorrect organizer password.' });
    } catch (err) {
      next(err);
    }
  });

  router.put('/master/admin-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await verifyBearerToken(req);
      if (role !== 'master') {
        res.status(403).json({ error: 'Master authorization required.' });
        return;
      }

      const newPassword =
        typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
      if (newPassword.length < 4 || newPassword.length > 128) {
        res.status(400).json({ error: 'New admin password must be 4–128 characters long.' });
        return;
      }

      const currentAuth = await getEffectiveAuthStore({ freshCloud: true });
      const { salt, hash } = hashPassword(newPassword);
      const nextVersion = Math.max(2, currentAuth.passwordVersion + 1);
      const nextAuth: AuthStoreRecord = {
        adminSalt: salt,
        adminHash: hash,
        passwordVersion: nextVersion,
        sessionSecret: currentAuth.sessionSecret || getSigningSecret(),
      };
      writeAuthStore(nextAuth);

      cloudAuthCache = {
        fetchedAt: Date.now(),
        record: {
          adminSalt: salt,
          adminHash: hash,
          passwordVersion: nextVersion,
        },
      };

      const authEnvelope = sealAuthEnvelope({
        adminSalt: salt,
        adminHash: hash,
        passwordVersion: nextVersion,
      });

      res.json({ ok: true, passwordVersion: nextVersion, authEnvelope });
    } catch (err) {
      next(err);
    }
  });

  router.put('/state', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await verifyBearerToken(req);
      if (!role) {
        res.status(401).json({ error: 'Unauthorized or expired session. Please unlock again.' });
        return;
      }

      const incoming = req.body as Partial<AppDataPayload>;
      if (!incoming || !Array.isArray(incoming.categories) || !Array.isArray(incoming.announcements)) {
        res.status(400).json({ error: 'Invalid state payload.' });
        return;
      }

      const existing = readStore();

      const nextAdminPanelConfig =
        role === 'master' && incoming.adminPanelConfig
          ? {
              ...existing.adminPanelConfig,
              ...incoming.adminPanelConfig,
              allowedTabs:
                Array.isArray(incoming.adminPanelConfig.allowedTabs) &&
                incoming.adminPanelConfig.allowedTabs.length > 0
                  ? incoming.adminPanelConfig.allowedTabs
                  : existing.adminPanelConfig.allowedTabs,
            }
          : existing.adminPanelConfig;

      const updated: AppDataPayload = {
        ...existing,
        ...incoming,
        banner: {
          ...existing.banner,
          ...(incoming.banner || {}),
        },
        siteCopy: {
          ...existing.siteCopy,
          ...(incoming.siteCopy || {}),
        },
        adminPanelConfig: nextAdminPanelConfig,
        lastUpdated: new Date().toISOString(),
      };

      writeStore(updated);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await verifyBearerToken(req);
      if (!role) {
        res.status(401).json({ error: 'Unauthorized or expired session.' });
        return;
      }

      const existing = readStore();
      if (role === 'admin' && !existing.adminPanelConfig.allowResetDefaults) {
        res.status(403).json({ error: 'Master has disabled Reset Defaults for standard admins.' });
        return;
      }

      const fresh = loadInitialData();
      if (role === 'admin') {
        fresh.adminPanelConfig = existing.adminPanelConfig;
      }
      fresh.lastUpdated = new Date().toISOString();
      writeStore(fresh);
      res.json(fresh);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', router);
  if (options?.mountRootRoutes) {
    app.use('/', router);
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ ok: false, error: message });
  });

  return app;
}

const app = createApiApp({ mountRootRoutes: Boolean(process.env.VERCEL) });
export default app;
