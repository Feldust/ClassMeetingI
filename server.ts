import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_APP_DATA } from './src/data/initialData.ts';
import type { AppDataState, AuthRole } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CKD76classmeeting';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'CKD76classmeetingMASTER';
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const AUTH_PATH = path.resolve(DATA_DIR, 'auth.json');

interface AuthStoreRecord {
  adminSalt: string;
  adminHash: string;
  passwordVersion: number;
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

function readAuthStore(): AuthStoreRecord {
  try {
    if (fs.existsSync(AUTH_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8')) as Partial<AuthStoreRecord>;
      if (parsed.adminSalt && parsed.adminHash && typeof parsed.passwordVersion === 'number') {
        return {
          adminSalt: parsed.adminSalt,
          adminHash: parsed.adminHash,
          passwordVersion: parsed.passwordVersion,
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
  };
  writeAuthStore(initial);
  return initial;
}

function writeAuthStore(record: AuthStoreRecord): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_PATH, JSON.stringify(record, null, 2), 'utf-8');
}

function signSessionToken(role: AuthRole, pwdVersion: number): string {
  const payload: SessionTokenPayload = {
    role,
    pwdVersion,
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyBearerToken(req: Request): AuthRole | null {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
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
      const auth = readAuthStore();
      if (payload.pwdVersion !== auth.passwordVersion) {
        return null;
      }
    }
    return payload.role;
  } catch {
    return null;
  }
}

function readStore(): AppDataState {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.announcements)) {
        return {
          ...structuredClone(INITIAL_APP_DATA),
          ...parsed,
          banner: {
            ...INITIAL_APP_DATA.banner,
            ...(parsed.banner || {}),
          },
          siteCopy: {
            ...INITIAL_APP_DATA.siteCopy,
            ...(parsed.siteCopy || {}),
          },
          adminPanelConfig: {
            ...INITIAL_APP_DATA.adminPanelConfig,
            ...(parsed.adminPanelConfig || {}),
            allowedTabs: Array.isArray(parsed.adminPanelConfig?.allowedTabs)
              ? parsed.adminPanelConfig.allowedTabs
              : INITIAL_APP_DATA.adminPanelConfig.allowedTabs,
          },
        };
      }
    }
  } catch (err) {
    console.error('Failed to read store.json, falling back to default:', err);
  }
  return structuredClone(INITIAL_APP_DATA);
}

function writeStore(nextState: AppDataState): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(nextState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write store.json:', err);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Ensure initial store & auth store exist on disk
  if (!fs.existsSync(STORE_PATH)) {
    writeStore(structuredClone(INITIAL_APP_DATA));
  }
  readAuthStore();

  app.get('/api/state', (_req: Request, res: Response) => {
    const state = readStore();
    res.json(state);
  });

  app.post('/api/verify-password', (req: Request, res: Response) => {
    const submitted = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedMode = req.body?.mode === 'master' ? 'master' : 'admin';

    if (!submitted) {
      res.status(401).json({ ok: false, error: 'Password is required.' });
      return;
    }

    if (requestedMode === 'master') {
      if (timingSafeTextEqual(submitted, MASTER_PASSWORD)) {
        const token = signSessionToken('master', 0);
        res.json({ ok: true, role: 'master', token });
        return;
      }
      res.status(401).json({ ok: false, error: 'Incorrect Master password.' });
      return;
    }

    // Standard Admin authentication (also supports dynamic env override if configured)
    const auth = readAuthStore();
    const matchesEnvAdmin =
      Boolean(process.env.ADMIN_PASSWORD) &&
      timingSafeTextEqual(submitted, process.env.ADMIN_PASSWORD as string);
    const matchesStoredAdmin = verifyHash(submitted, auth.adminSalt, auth.adminHash);

    if (matchesEnvAdmin || matchesStoredAdmin) {
      const token = signSessionToken('admin', auth.passwordVersion);
      res.json({ ok: true, role: 'admin', token });
      return;
    }

    res.status(401).json({ ok: false, error: 'Incorrect organizer password.' });
  });

  app.put('/api/master/admin-password', (req: Request, res: Response) => {
    const role = verifyBearerToken(req);
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

    const currentAuth = readAuthStore();
    const { salt, hash } = hashPassword(newPassword);
    const nextAuth: AuthStoreRecord = {
      adminSalt: salt,
      adminHash: hash,
      passwordVersion: currentAuth.passwordVersion + 1,
    };
    writeAuthStore(nextAuth);

    res.json({ ok: true, passwordVersion: nextAuth.passwordVersion });
  });

  app.put('/api/state', (req: Request, res: Response) => {
    const role = verifyBearerToken(req);
    if (!role) {
      res.status(401).json({ error: 'Unauthorized or expired session. Please unlock again.' });
      return;
    }

    const incoming = req.body as Partial<AppDataState>;
    if (!incoming || !Array.isArray(incoming.categories) || !Array.isArray(incoming.announcements)) {
      res.status(400).json({ error: 'Invalid state payload.' });
      return;
    }

    const existing = readStore();

    // Only Master can modify adminPanelConfig; standard Admin retains Master's config
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

    const updated: AppDataState = {
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
  });

  app.post('/api/reset', (req: Request, res: Response) => {
    const role = verifyBearerToken(req);
    if (!role) {
      res.status(401).json({ error: 'Unauthorized or expired session.' });
      return;
    }

    const existing = readStore();
    if (role === 'admin' && !existing.adminPanelConfig.allowResetDefaults) {
      res.status(403).json({ error: 'Master has disabled Reset Defaults for standard admins.' });
      return;
    }

    const fresh = structuredClone(INITIAL_APP_DATA);
    if (role === 'admin') {
      fresh.adminPanelConfig = existing.adminPanelConfig;
    }
    fresh.lastUpdated = new Date().toISOString();
    writeStore(fresh);
    res.json(fresh);
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CKD 76 Announcement Hub listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
