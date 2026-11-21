import { useState, useEffect, useCallback } from 'react';
import { INITIAL_APP_DATA } from '../data/initialData';
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

  useEffect(() => {
    let active = true;
    fetch('/api/state')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json() as Promise<Partial<AppDataState>>;
      })
      .then((remote) => {
        if (active && remote && Array.isArray(remote.categories)) {
          const normalized = normalizeAppData(remote);
          setData(normalized);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(normalized));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Offline or fallback to local cache already loaded
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistData = useCallback(
    async (
      nextState: AppDataState,
      sessionToken: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const stamped = normalizeAppData({
        ...nextState,
        lastUpdated: new Date().toISOString(),
      });

      setSaveStatus('saving');
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(stamped),
        });
        if (res.ok) {
          const saved = normalizeAppData((await res.json()) as Partial<AppDataState>);
          setData(saved);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(saved));
          } catch {
            // ignore
          }
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
          return { ok: true };
        }
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return { ok: false, error: errBody.error || 'Failed to save changes.' };
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return { ok: false, error: 'Network error while saving changes.' };
      }
    },
    []
  );

  const resetToDefault = useCallback(
    async (sessionToken: string): Promise<{ ok: boolean; error?: string }> => {
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const fresh = normalizeAppData((await res.json()) as Partial<AppDataState>);
          setData(fresh);
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(fresh));
          } catch {
            // ignore
          }
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
          return { ok: true };
        }
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return { ok: false, error: errBody.error || 'Failed to reset data.' };
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2500);
        return { ok: false, error: 'Network error while resetting data.' };
      }
    },
    []
  );

  const changeAdminPassword = useCallback(
    async (
      newPassword: string,
      masterToken: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/master/admin-password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${masterToken}`,
          },
          body: JSON.stringify({ newPassword }),
        });
        const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok && payload.ok) {
          return { ok: true };
        }
        return { ok: false, error: payload.error || 'Could not update admin password.' };
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
    persistData,
    resetToDefault,
    changeAdminPassword,
  };
}
