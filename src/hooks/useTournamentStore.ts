import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { INITIAL_APP_DATA } from '../data/initialData';
import {
  auth,
  db,
  PUBLIC_STATE_COLLECTION,
  PUBLIC_STATE_DOC_ID,
  ADMIN_AUTH_COLLECTION,
  ADMIN_AUTH_DOC_ID,
  OperationType,
  handleFirestoreError,
  signInWithGooglePopup,
  signOutFirebase,
  checkIsCloudAuthorized,
  isBootstrappedMasterUser,
  publishPublicStateToFirestore,
  publishAdminAuthToFirestore,
} from '../firebase';
import type { AppDataState, UISettings } from '../types';

const LOCAL_DATA_KEY = 'ckd76_app_data_v1';
const LOCAL_UI_KEY = 'ckd76_ui_settings_v1';

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'light',
  soundEnabled: true,
  soundVolume: 0.55,
  accentTone: 'amber',
  motionPreference: 'smooth',
  compactDensity: false,
};

export function useUISettings() {
  const [settings, setSettings] = useState<UISettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_UI_KEY);
      if (saved) {
        return { ...DEFAULT_UI_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_UI_SETTINGS;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-accent', settings.accentTone);
    try {
      localStorage.setItem(LOCAL_UI_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<UISettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, updateSettings };
}

function normalizeAppData(incoming: Partial<AppDataState>): AppDataState {
  return {
    ...INITIAL_APP_DATA,
    ...incoming,
    banner: {
      ...INITIAL_APP_DATA.banner,
      ...(incoming.banner || {}),
    },
    siteCopy: {
      ...INITIAL_APP_DATA.siteCopy,
      ...(incoming.siteCopy || {}),
    },
    adminPanelConfig: {
      ...INITIAL_APP_DATA.adminPanelConfig,
      ...(incoming.adminPanelConfig || {}),
      allowedTabs: Array.isArray(incoming.adminPanelConfig?.allowedTabs)
        ? incoming.adminPanelConfig.allowedTabs
        : INITIAL_APP_DATA.adminPanelConfig.allowedTabs,
    },
    teams: Array.isArray(incoming.teams) ? incoming.teams : INITIAL_APP_DATA.teams,
    announcements: Array.isArray(incoming.announcements)
      ? incoming.announcements
      : INITIAL_APP_DATA.announcements,
    categories: Array.isArray(incoming.categories)
      ? incoming.categories
      : INITIAL_APP_DATA.categories,
    leaderboards: Array.isArray(incoming.leaderboards)
      ? incoming.leaderboards
      : INITIAL_APP_DATA.leaderboards,
  };
}

function formatCloudError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';

  if (code === 'auth/unauthorized-domain' || raw.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Google Sign-In is blocked on "${host}". Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-closed-by-user' || raw.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing Cloud Sync.';
  }
  if (code === 'auth/popup-blocked' || raw.includes('auth/popup-blocked')) {
    return 'Browser blocked the Google sign-in popup. Allow popups or click "Connect Google Sync" first.';
  }
  if (raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('insufficient')) {
    return 'This Google account is not authorized to publish to Cloud Firestore yet. Sign in with cassius.steve123@gmail.com or ask Master to add your UID.';
  }
  return raw || 'Could not sync changes to Cloud Firestore.';
}

export function useTournamentStore() {
  const [data, setData] = useState<AppDataState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_DATA_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<AppDataState>;
        if (parsed && Array.isArray(parsed.categories)) {
          return normalizeAppData(parsed);
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_APP_DATA;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cloudUser, setCloudUser] = useState<User | null>(() => auth.currentUser);
  const [cloudAuthorized, setCloudAuthorized] = useState<boolean>(false);
  const [cloudAuthChecking, setCloudAuthChecking] = useState<boolean>(false);
  const [hasCloudDocument, setHasCloudDocument] = useState<boolean>(false);
  const [cloudPasswordVersion, setCloudPasswordVersion] = useState<number>(1);
  const hasCloudDocRef = useRef<boolean>(false);

  // Track Google Auth state & verify organizer permissions in Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      if (!user) {
        setCloudAuthorized(false);
        return;
      }
      setCloudAuthChecking(true);
      try {
        const ok = await checkIsCloudAuthorized(user);
        setCloudAuthorized(ok);
      } catch {
        setCloudAuthorized(false);
      } finally {
        setCloudAuthChecking(false);
      }
    });
    return () => unsub();
  }, []);

  // Authoritative cross-device sync via Cloud Firestore publicState/current
  useEffect(() => {
    let active = true;
    const stateRef = doc(db, PUBLIC_STATE_COLLECTION, PUBLIC_STATE_DOC_ID);
    const docPath = `${PUBLIC_STATE_COLLECTION}/${PUBLIC_STATE_DOC_ID}`;

    const applyNormalized = (incoming: Partial<AppDataState>) => {
      if (!active || !Array.isArray(incoming.categories)) return;
      const normalized = normalizeAppData(incoming);
      setData(normalized);
      try {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
    };

    // 1. Force a fresh server read immediately on mount so different devices never stay stale
    getDocFromServer(stateRef)
      .then((snap) => {
        if (!active) return;
        if (snap.exists()) {
          hasCloudDocRef.current = true;
          setHasCloudDocument(true);
          applyNormalized(snap.data() as Partial<AppDataState>);
          setIsLoading(false);
        } else {
          // No cloud document published yet; fall back to /api/state
          return fetch('/api/state')
            .then((res) => (res.ok ? (res.json() as Promise<Partial<AppDataState>>) : null))
            .then((remote) => {
              if (active && remote && !hasCloudDocRef.current) {
                applyNormalized(remote);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              if (active) setIsLoading(false);
            });
        }
      })
      .catch(() => {
        // If offline or Firestore unreachable, fall back to /api/state
        fetch('/api/state')
          .then((res) => (res.ok ? (res.json() as Promise<Partial<AppDataState>>) : null))
          .then((remote) => {
            if (active && remote && !hasCloudDocRef.current) {
              applyNormalized(remote);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (active) setIsLoading(false);
          });
      });

    // 2. Real-time cross-device updates whenever Admin/Master publishes
    const unsubscribe = onSnapshot(
      stateRef,
      (snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          hasCloudDocRef.current = true;
          setHasCloudDocument(true);
          applyNormalized(snapshot.data() as Partial<AppDataState>);
          setIsLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, docPath);
      }
    );

    const authRef = doc(db, ADMIN_AUTH_COLLECTION, ADMIN_AUTH_DOC_ID);
    const authUnsub = onSnapshot(
      authRef,
      (snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          const pv = snapshot.data()?.passwordVersion;
          if (typeof pv === 'number' && pv >= 1) {
            setCloudPasswordVersion(pv);
          }
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message.toLowerCase() : '';
        if (msg.includes('permission')) {
          handleFirestoreError(
            error,
            OperationType.GET,
            `${ADMIN_AUTH_COLLECTION}/${ADMIN_AUTH_DOC_ID}`
          );
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
      authUnsub();
    };
  }, []);

  const connectGoogleSync = useCallback(async (): Promise<{
    ok: boolean;
    authorized?: boolean;
    error?: string;
  }> => {
    try {
      const user = await signInWithGooglePopup();
      setCloudUser(user);
      const ok = await checkIsCloudAuthorized(user);
      setCloudAuthorized(ok);
      if (!ok) {
        return {
          ok: false,
          authorized: false,
          error: `Signed in as ${user.email || user.uid}, which is not authorized to publish. Sign in with cassius.steve123@gmail.com or have Master add UID "${user.uid}" under Master Controls.`,
        };
      }
      return { ok: true, authorized: true };
    } catch (error) {
      return { ok: false, error: formatCloudError(error) };
    }
  }, []);

  const disconnectGoogleSync = useCallback(async () => {
    await signOutFirebase();
    setCloudUser(null);
    setCloudAuthorized(false);
  }, []);

  const persistData = useCallback(
    async (
      nextState: AppDataState,
      sessionToken: string
    ): Promise<{ ok: boolean; error?: string; syncedToCloud?: boolean }> => {
      const stamped = normalizeAppData({
        ...nextState,
        lastUpdated: new Date().toISOString(),
      });

      setSaveStatus('saving');

      // Ensure Google Cloud Sync session BEFORE async network requests so popup stays inside user click gesture
      let currentUser = auth.currentUser;
      let isAuthorized = currentUser ? await checkIsCloudAuthorized(currentUser) : false;

      if (!currentUser) {
        try {
          currentUser = await signInWithGooglePopup();
          setCloudUser(currentUser);
          isAuthorized = await checkIsCloudAuthorized(currentUser);
          setCloudAuthorized(isAuthorized);
        } catch (authErr) {
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2500);
          return { ok: false, error: formatCloudError(authErr) };
        }
      }

      if (!isAuthorized) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return {
          ok: false,
          error: `Signed in as ${currentUser?.email || currentUser?.uid}, which is not authorized to publish across devices. Sign in with cassius.steve123@gmail.com or have Master authorize UID "${currentUser?.uid || ''}".`,
        };
      }

      // 1. Update local/API server state as well (non-fatal if remote serverless /api/state is ephemeral)
      let serverData = stamped;
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(stamped),
        });
        if (res.status === 401 || res.status === 403) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2500);
          return { ok: false, error: errBody.error || 'Session expired. Please re-unlock Admin.' };
        }
        if (res.ok) {
          serverData = normalizeAppData((await res.json()) as Partial<AppDataState>);
        }
      } catch {
        // Proceed with Firestore publish so cross-device persistence still succeeds
      }

      // 2. Publish authoritative cross-device state to Cloud Firestore
      try {
        await publishPublicStateToFirestore(serverData);
        hasCloudDocRef.current = true;
        setHasCloudDocument(true);
        setData(serverData);
        try {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(serverData));
        } catch {
          // ignore
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return { ok: true, syncedToCloud: true };
      } catch (cloudErr) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return { ok: false, error: formatCloudError(cloudErr) };
      }
    },
    []
  );

  const changeAdminPassword = useCallback(
    async (
      newPassword: string,
      masterToken: string
    ): Promise<{ ok: boolean; syncedToCloud?: boolean; warning?: string; error?: string }> => {
      // Trigger Google sign-in before async fetch so popup stays inside submit event gesture
      let currentUser = auth.currentUser;
      let cloudSyncNote = '';
      if (!currentUser) {
        try {
          currentUser = await signInWithGooglePopup();
          setCloudUser(currentUser);
          const ok = await checkIsCloudAuthorized(currentUser);
          setCloudAuthorized(ok);
        } catch (authErr) {
          cloudSyncNote = formatCloudError(authErr);
        }
      }

      try {
        const res = await fetch('/api/master/admin-password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${masterToken}`,
          },
          body: JSON.stringify({ newPassword }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          passwordVersion?: number;
          authEnvelope?: string;
          error?: string;
        };
        if (!res.ok || !payload.ok) {
          return { ok: false, error: payload.error || 'Could not update admin password.' };
        }

        if (
          payload.authEnvelope &&
          typeof payload.passwordVersion === 'number' &&
          isBootstrappedMasterUser(auth.currentUser)
        ) {
          try {
            await publishAdminAuthToFirestore(payload.authEnvelope, payload.passwordVersion);
            setCloudPasswordVersion(payload.passwordVersion);
            return { ok: true, syncedToCloud: true };
          } catch (cloudErr) {
            return {
              ok: true,
              syncedToCloud: false,
              warning: `Updated on this server, but Cloud Sync failed: ${formatCloudError(cloudErr)}`,
            };
          }
        }

        return {
          ok: true,
          syncedToCloud: false,
          warning:
            cloudSyncNote ||
            'Updated on this server only. Connect Google Sync with cassius.steve123@gmail.com to invalidate the old password across all devices.',
        };
      } catch {
        return { ok: false, error: 'Network error while updating admin password.' };
      }
    },
    []
  );

  return {
    data,
    isLoading,
    saveStatus,
    cloudUser,
    cloudAuthorized,
    cloudAuthChecking,
    isCloudMaster: isBootstrappedMasterUser(cloudUser),
    hasCloudDocument,
    cloudPasswordVersion,
    connectGoogleSync,
    disconnectGoogleSync,
    persistData,
    changeAdminPassword,
  };
}
