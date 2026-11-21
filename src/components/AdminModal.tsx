import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Calendar,
  GitBranch,
  Users,
  BarChart3,
  LogOut,
  Globe,
  Crown,
  KeyRound,
  Sliders,
} from 'lucide-react';
import type {
  AdminPanelConfig,
  AdminPanelTabId,
  Announcement,
  AnnouncementPriority,
  AppDataState,
  AuthRole,
  BracketMatch,
  BracketRound,
  CategoryCompetition,
  LeaderboardEntry,
  LeaderboardGame,
  MatchEvent,
  MatchStatus,
  RundownStatus,
  SiteBannerInfo,
  SiteCopyConfig,
  Team,
} from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  authRole: AuthRole | null;
  sessionToken: string;
  onUnlockSuccess: (role: AuthRole, token: string) => void;
  onLockAdmin: () => void;
  appData: AppDataState;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSaveData: (
    nextData: AppDataState,
    token: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onResetDefault: (token: string) => Promise<{ ok: boolean; error?: string }>;
  onChangeAdminPassword: (
    newPassword: string,
    masterToken: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onPlaySound: (kind: 'tap' | 'switch' | 'chime' | 'unlock' | 'error') => void;
}

type ModalTab = 'master' | AdminPanelTabId;

const EVENT_TYPE_PRESETS = [
  'Goal by',
  'Assist by',
  'Yellow Card',
  'Save by',
  'Ace by',
  'Set Score',
  '2-Pt Shot by',
  'Board Clear',
  'Fast Money',
];

const ALL_ADMIN_TABS: { id: AdminPanelTabId; label: string }[] = [
  { id: 'site', label: 'Site & Navigation' },
  { id: 'announcements', label: 'Rundown & Schedule' },
  { id: 'brackets', label: 'Match Results & Brackets' },
  { id: 'leaderboards', label: 'Leaderboards' },
  { id: 'teams', label: 'Teams & Classes' },
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  isUnlocked,
  authRole,
  sessionToken,
  onUnlockSuccess,
  onLockAdmin,
  appData,
  saveStatus,
  onSaveData,
  onResetDefault,
  onChangeAdminPassword,
  onPlaySound,
}) => {
  const [loginMode, setLoginMode] = useState<AuthRole>('admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState<ModalTab>('site');
  const [draft, setDraft] = useState<AppDataState>(() => structuredClone(appData));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [actionError, setActionError] = useState('');

  const [selectedCatId, setSelectedCatId] = useState<string>(
    appData.categories[0]?.id || 'soccer-match'
  );
  const [selectedLbId, setSelectedLbId] = useState<string>(
    appData.leaderboards[0]?.id || 'lb-overall'
  );
  const [confirmReset, setConfirmReset] = useState(false);

  // Master password rotation state
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [confirmAdminPwd, setConfirmAdminPwd] = useState('');
  const [pwdUpdating, setPwdUpdating] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const isMaster = authRole === 'master';
  const canDelete = isMaster || appData.adminPanelConfig.allowDeleteItems;
  const canReset = isMaster || appData.adminPanelConfig.allowResetDefaults;

  const availableTabs = useMemo(() => {
    const base: { id: ModalTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { id: 'site', label: 'Site & Navigation', icon: Globe },
      { id: 'announcements', label: 'Rundown & Schedule', icon: Calendar },
      { id: 'brackets', label: 'Match Results & Brackets', icon: GitBranch },
      { id: 'leaderboards', label: 'Leaderboards', icon: BarChart3 },
      { id: 'teams', label: 'Teams & Classes', icon: Users },
    ];

    if (isMaster) {
      return [
        { id: 'master' as const, label: 'Master Controls', icon: Crown },
        ...base,
      ];
    }

    const allowedSet = new Set(appData.adminPanelConfig.allowedTabs);
    const filtered = base.filter((t) => allowedSet.has(t.id as AdminPanelTabId));
    return filtered.length > 0 ? filtered : base;
  }, [isMaster, appData.adminPanelConfig.allowedTabs]);

  useEffect(() => {
    if (isOpen) {
      setDraft(structuredClone(appData));
      setHasUnsavedChanges(false);
      setAuthError('');
      setActionError('');
      setConfirmReset(false);
      setPwdFeedback(null);
    }
  }, [isOpen, appData]);

  useEffect(() => {
    if (isUnlocked && availableTabs.length > 0) {
      if (!availableTabs.some((t) => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id);
      }
    }
  }, [isUnlocked, availableTabs, activeTab]);

  if (!isOpen) return null;

  const updateDraft = (updater: (prev: AppDataState) => AppDataState) => {
    setDraft((prev) => updater(prev));
    setHasUnsavedChanges(true);
    setActionError('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setVerifying(true);
    const trimmed = passwordInput.trim();

    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed, mode: loginMode }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        role?: AuthRole;
        token?: string;
        error?: string;
      } | null;
      if (res.ok && payload?.ok && payload.token && payload.role) {
        onPlaySound('unlock');
        setPasswordInput('');
        setActiveTab(payload.role === 'master' ? 'master' : availableTabs[0]?.id || 'site');
        onUnlockSuccess(payload.role, payload.token);
      } else {
        onPlaySound('error');
        if (!payload || (res.status !== 401 && res.status !== 403 && !payload.error)) {
          setAuthError(`Authentication endpoint error (HTTP ${res.status}). Check server / API deployment.`);
        } else {
          setAuthError(
            payload.error ||
              (loginMode === 'master'
                ? 'Incorrect Master password.'
                : 'Incorrect administrator password.')
          );
        }
      }
    } catch {
      onPlaySound('error');
      setAuthError('Unable to reach authentication server.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePublish = async () => {
    setActionError('');
    const result = await onSaveData(draft, sessionToken);
    if (result.ok) {
      onPlaySound('chime');
      setHasUnsavedChanges(false);
    } else {
      onPlaySound('error');
      setActionError(result.error || 'Could not publish changes.');
    }
  };

  const handleUpdateMasterAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);
    if (newAdminPwd.trim().length < 4) {
      setPwdFeedback({ type: 'err', msg: 'Password must be at least 4 characters.' });
      onPlaySound('error');
      return;
    }
    if (newAdminPwd.trim() !== confirmAdminPwd.trim()) {
      setPwdFeedback({ type: 'err', msg: 'Passwords do not match.' });
      onPlaySound('error');
      return;
    }
    setPwdUpdating(true);
    const res = await onChangeAdminPassword(newAdminPwd.trim(), sessionToken);
    setPwdUpdating(false);
    if (res.ok) {
      onPlaySound('chime');
      setNewAdminPwd('');
      setConfirmAdminPwd('');
      setPwdFeedback({
        type: 'ok',
        msg: 'Admin password updated! Previous admin sessions have been invalidated.',
      });
    } else {
      onPlaySound('error');
      setPwdFeedback({ type: 'err', msg: res.error || 'Failed to update admin password.' });
    }
  };

  // --- Site & Master Helpers ---
  const handleUpdateBanner = (patch: Partial<SiteBannerInfo>) => {
    updateDraft((prev) => ({
      ...prev,
      banner: { ...prev.banner, ...patch },
    }));
  };

  const handleUpdateSiteCopy = (patch: Partial<SiteCopyConfig>) => {
    updateDraft((prev) => ({
      ...prev,
      siteCopy: { ...prev.siteCopy, ...patch },
    }));
  };

  const handleUpdateAdminPanelConfig = (patch: Partial<AdminPanelConfig>) => {
    updateDraft((prev) => ({
      ...prev,
      adminPanelConfig: { ...prev.adminPanelConfig, ...patch },
    }));
  };

  const handleToggleAllowedTab = (tabId: AdminPanelTabId) => {
    const current = draft.adminPanelConfig.allowedTabs;
    const exists = current.includes(tabId);
    if (exists && current.length <= 1) return; // Keep at least 1 tab accessible
    const next = exists ? current.filter((t) => t !== tabId) : [...current, tabId];
    handleUpdateAdminPanelConfig({ allowedTabs: next });
  };

  // --- Rundown & Schedule Helpers ---
  const handleAddAnnouncement = () => {
    onPlaySound('tap');
    const newAnn: Announcement = {
      id: `run-${Date.now()}`,
      title: 'New Rundown Activity Slot',
      summary: 'Concise one-sentence summary of this scheduled session.',
      body: 'Full activity instructions, reporting times, and venue guidelines.',
      category: 'General',
      date: 'Nov 20, 2026 · 08:00 – 09:00',
      dayLabel: 'Day 2 · Fri, Nov 20',
      timeRange: '08:00 – 09:00',
      scheduleStatus: 'Upcoming',
      venue: 'Central Courtyard',
      author: 'CKD 76 Committee',
      isFeatured: false,
      priority: 'Match',
    };
    updateDraft((prev) => ({
      ...prev,
      announcements: [newAnn, ...prev.announcements],
    }));
  };

  const handleUpdateAnnouncement = (id: string, patch: Partial<Announcement>) => {
    updateDraft((prev) => ({
      ...prev,
      announcements: prev.announcements.map((a) => {
        if (patch.isFeatured && a.id !== id) {
          return { ...a, isFeatured: false };
        }
        return a.id === id ? { ...a, ...patch } : a;
      }),
    }));
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!canDelete) return;
    onPlaySound('tap');
    updateDraft((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
  };

  // --- Category & Bracket Helpers ---
  const activeCat =
    draft.categories.find((c) => c.id === selectedCatId) || draft.categories[0] || null;

  const handleAddCategory = () => {
    onPlaySound('tap');
    const slug = `cat-${Date.now()}`;
    const t = draft.teams;
    const newCat: CategoryCompetition = {
      id: slug,
      name: 'New Competition',
      tagline: 'Knockout class tournament category.',
      description: 'Official competition bracket and upcoming schedule.',
      venue: 'Central Courtyard',
      format: '8-Team Single Elimination',
      scheduleWindow: 'Nov 20 – Nov 23, 2026',
      imageUrl: '/src/assets/images/hero_class_meeting_1795157529622.jpg',
      matches: [
        {
          id: `${slug}-qf1`,
          round: 'Quarterfinals',
          matchOrder: 1,
          teamAId: t[0]?.id || null,
          teamBId: t[7]?.id || null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 20, 2026',
          time: '09:00',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-qf2`,
          round: 'Quarterfinals',
          matchOrder: 2,
          teamAId: t[1]?.id || null,
          teamBId: t[6]?.id || null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 20, 2026',
          time: '10:00',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-qf3`,
          round: 'Quarterfinals',
          matchOrder: 3,
          teamAId: t[2]?.id || null,
          teamBId: t[5]?.id || null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 20, 2026',
          time: '11:00',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-qf4`,
          round: 'Quarterfinals',
          matchOrder: 4,
          teamAId: t[3]?.id || null,
          teamBId: t[4]?.id || null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 20, 2026',
          time: '13:00',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-sf1`,
          round: 'Semifinals',
          matchOrder: 1,
          teamAId: null,
          teamBId: null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 21, 2026',
          time: '10:00',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-sf2`,
          round: 'Semifinals',
          matchOrder: 2,
          teamAId: null,
          teamBId: null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 21, 2026',
          time: '11:30',
          venue: 'Central Courtyard',
          events: [],
        },
        {
          id: `${slug}-fin`,
          round: 'Final',
          matchOrder: 1,
          teamAId: null,
          teamBId: null,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          status: 'Upcoming',
          date: 'Nov 22, 2026',
          time: '15:00',
          venue: 'Central Courtyard',
          events: [],
        },
      ],
    };
    updateDraft((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    setSelectedCatId(slug);
  };

  const handleUpdateCategoryMeta = (catId: string, patch: Partial<CategoryCompetition>) => {
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === catId ? { ...c, ...patch } : c)),
    }));
  };

  const handleDeleteCategory = (catId: string) => {
    if (!canDelete || draft.categories.length <= 1) return;
    onPlaySound('tap');
    const remaining = draft.categories.filter((c) => c.id !== catId);
    updateDraft((prev) => ({
      ...prev,
      categories: remaining,
    }));
    if (selectedCatId === catId && remaining[0]) {
      setSelectedCatId(remaining[0].id);
    }
  };

  const handleAddMatch = (catId: string) => {
    onPlaySound('tap');
    const cat = draft.categories.find((c) => c.id === catId);
    const nextOrder = (cat?.matches.length || 0) + 1;
    const newMatch: BracketMatch = {
      id: `${catId}-m-${Date.now()}`,
      round: 'Quarterfinals',
      matchOrder: nextOrder,
      teamAId: draft.teams[0]?.id || null,
      teamBId: draft.teams[1]?.id || null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      status: 'Upcoming',
      date: 'Nov 20, 2026',
      time: '10:00',
      venue: cat?.venue || 'Central Courtyard',
      note: '',
      referee: '',
      mvp: '',
      summary: '',
      events: [],
    };
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, matches: [...c.matches, newMatch] } : c
      ),
    }));
  };

  const handleDeleteMatch = (catId: string, matchId: string) => {
    if (!canDelete) return;
    onPlaySound('tap');
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, matches: c.matches.filter((m) => m.id !== matchId) } : c
      ),
    }));
  };

  const handleUpdateMatch = (
    catId: string,
    matchId: string,
    patch: Partial<BracketMatch>,
    autoAdvanceTeamId?: string | null
  ) => {
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) => {
        if (cat.id !== catId) return cat;
        const targetMatch = cat.matches.find((m) => m.id === matchId);
        let nextMatches = cat.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m));

        // Automatically advance winner to Quarterfinals, Semifinals, or Final
        if (targetMatch && autoAdvanceTeamId !== undefined) {
          if (targetMatch.round === 'Qualifying Round') {
            const qfOrder = Math.ceil(targetMatch.matchOrder / 2);
            const isSlotA = targetMatch.matchOrder % 2 === 1;
            nextMatches = nextMatches.map((m) => {
              if (m.round === 'Quarterfinals' && m.matchOrder === qfOrder) {
                return isSlotA
                  ? { ...m, teamAId: autoAdvanceTeamId }
                  : { ...m, teamBId: autoAdvanceTeamId };
              }
              return m;
            });
          } else if (targetMatch.round === 'Quarterfinals') {
            const sfOrder = targetMatch.matchOrder <= 2 ? 1 : 2;
            const isSlotA = targetMatch.matchOrder % 2 === 1;
            nextMatches = nextMatches.map((m) => {
              if (m.round === 'Semifinals' && m.matchOrder === sfOrder) {
                return isSlotA
                  ? { ...m, teamAId: autoAdvanceTeamId }
                  : { ...m, teamBId: autoAdvanceTeamId };
              }
              return m;
            });
          } else if (targetMatch.round === 'Semifinals') {
            const isSlotA = targetMatch.matchOrder === 1;
            nextMatches = nextMatches.map((m) => {
              if (m.round === 'Final' && m.matchOrder === 1) {
                return isSlotA
                  ? { ...m, teamAId: autoAdvanceTeamId }
                  : { ...m, teamBId: autoAdvanceTeamId };
              }
              return m;
            });
          }
        }

        return { ...cat, matches: nextMatches };
      }),
    }));
  };

  const handleAddMatchEvent = (catId: string, matchId: string) => {
    onPlaySound('tap');
    const newEvent: MatchEvent = {
      id: `ev-${Date.now()}`,
      type: 'Goal by',
      player: 'Player Name',
      teamSide: 'A',
      minuteOrStage: "15'",
      detail: '',
    };
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === catId
          ? {
              ...cat,
              matches: cat.matches.map((m) =>
                m.id === matchId ? { ...m, events: [...(m.events || []), newEvent] } : m
              ),
            }
          : cat
      ),
    }));
  };

  const handleUpdateMatchEvent = (
    catId: string,
    matchId: string,
    eventId: string,
    patch: Partial<MatchEvent>
  ) => {
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === catId
          ? {
              ...cat,
              matches: cat.matches.map((m) =>
                m.id === matchId
                  ? {
                      ...m,
                      events: (m.events || []).map((ev) =>
                        ev.id === eventId ? { ...ev, ...patch } : ev
                      ),
                    }
                  : m
              ),
            }
          : cat
      ),
    }));
  };

  const handleDeleteMatchEvent = (catId: string, matchId: string, eventId: string) => {
    onPlaySound('tap');
    updateDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === catId
          ? {
              ...cat,
              matches: cat.matches.map((m) =>
                m.id === matchId
                  ? { ...m, events: (m.events || []).filter((ev) => ev.id !== eventId) }
                  : m
              ),
            }
          : cat
      ),
    }));
  };

  // --- Teams Helpers ---
  const handleAddTeam = () => {
    onPlaySound('tap');
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: 'Class XII-D Phoenix',
      shortCode: 'XII-D',
      cohort: 'Grade 12',
      captain: 'Team Captain',
      motto: 'United on every court.',
    };
    updateDraft((prev) => ({
      ...prev,
      teams: [...prev.teams, newTeam],
    }));
  };

  const handleUpdateTeam = (teamId: string, patch: Partial<Team>) => {
    updateDraft((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
    }));
  };

  const handleDeleteTeam = (teamId: string) => {
    if (!canDelete) return;
    onPlaySound('tap');
    updateDraft((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== teamId),
    }));
  };

  // --- Leaderboards Helpers ---
  const activeLb =
    draft.leaderboards.find((l) => l.id === selectedLbId) || draft.leaderboards[0] || null;

  const handleAddLeaderboardGame = () => {
    onPlaySound('tap');
    const newId = `lb-${Date.now()}`;
    const newGame: LeaderboardGame = {
      id: newId,
      name: 'New Game Standings',
      gameType: 'points-ranking',
      subtitle: 'Points leaderboard for this event mode.',
      metricLabel: 'Points',
      detailColumnLabel: 'Highlight / Stat',
      entries: [
        {
          id: `lbe-${Date.now()}`,
          teamId: draft.teams[0]?.id || '',
          participantName: draft.teams[0]?.name || 'Class XII-A Falcons',
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
          metricDetail: 'Opening Round Winner',
          points: 25,
        },
      ],
    };
    updateDraft((prev) => ({
      ...prev,
      leaderboards: [...prev.leaderboards, newGame],
    }));
    setSelectedLbId(newId);
  };

  const handleUpdateLbMeta = (lbId: string, patch: Partial<LeaderboardGame>) => {
    updateDraft((prev) => ({
      ...prev,
      leaderboards: prev.leaderboards.map((l) => (l.id === lbId ? { ...l, ...patch } : l)),
    }));
  };

  const handleDeleteLeaderboardGame = (lbId: string) => {
    if (!canDelete || draft.leaderboards.length <= 1) return;
    onPlaySound('tap');
    const remaining = draft.leaderboards.filter((l) => l.id !== lbId);
    updateDraft((prev) => ({
      ...prev,
      leaderboards: remaining,
    }));
    if (selectedLbId === lbId && remaining[0]) {
      setSelectedLbId(remaining[0].id);
    }
  };

  const handleAddLbEntry = (lbId: string) => {
    onPlaySound('tap');
    const newEntry: LeaderboardEntry = {
      id: `lbe-${Date.now()}`,
      teamId: draft.teams[0]?.id || '',
      participantName: draft.teams[0]?.name || 'New Contender',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      metricDetail: 'Active',
      points: 0,
    };
    updateDraft((prev) => ({
      ...prev,
      leaderboards: prev.leaderboards.map((l) =>
        l.id === lbId ? { ...l, entries: [...l.entries, newEntry] } : l
      ),
    }));
  };

  const handleUpdateLbEntry = (
    lbId: string,
    entryId: string,
    patch: Partial<LeaderboardEntry>
  ) => {
    updateDraft((prev) => ({
      ...prev,
      leaderboards: prev.leaderboards.map((l) =>
        l.id === lbId
          ? {
              ...l,
              entries: l.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
            }
          : l
      ),
    }));
  };

  const handleDeleteLbEntry = (lbId: string, entryId: string) => {
    if (!canDelete) return;
    onPlaySound('tap');
    updateDraft((prev) => ({
      ...prev,
      leaderboards: prev.leaderboards.map((l) =>
        l.id === lbId ? { ...l, entries: l.entries.filter((e) => e.id !== entryId) } : l
      ),
    }));
  };

  // --- Password Prompt View ---
  if (!isUnlocked) {
    const isMasterLogin = loginMode === 'master';
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-[#FBF9F5] dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-2xl text-stone-900 dark:text-stone-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isMasterLogin
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    : 'bg-stone-200/80 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                }`}
              >
                {isMasterLogin ? <Crown className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold">
                  {isMasterLogin
                    ? 'Master Control Access'
                    : appData.adminPanelConfig.lockPromptTitle}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {isMasterLogin
                    ? 'Full authority over all events, Admin Panel settings, and passwords'
                    : appData.adminPanelConfig.lockPromptMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Mode Switcher */}
          <div className="mt-5 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-200/60 dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800">
            <button
              type="button"
              onClick={() => {
                onPlaySound('switch');
                setLoginMode('admin');
                setAuthError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                !isMasterLogin
                  ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onPlaySound('switch');
                setLoginMode('master');
                setAuthError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isMasterLogin
                  ? 'bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Master Panel</span>
            </button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="ckd-admin-pwd"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
              >
                {isMasterLogin ? 'Master Password' : 'Administrator Password'}
              </label>
              <div className="relative">
                <input
                  id="ckd-admin-pwd"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={isMasterLogin ? 'Enter Master password...' : 'Enter Admin password...'}
                  autoFocus
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-600 dark:focus:border-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {authError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{authError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying || !passwordInput.trim()}
                className="px-5 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {verifying
                  ? 'Verifying...'
                  : isMasterLogin
                  ? 'Unlock Master Panel'
                  : 'Unlock Admin Panel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Full Admin / Master Workspace Modal ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-5">
      <div className="w-full max-w-6xl h-[92vh] rounded-2xl bg-[#FBF9F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden text-stone-900 dark:text-stone-100">
        {/* Top Header */}
        <div className="px-5 sm:px-7 py-4 bg-white dark:bg-[#1C1917] border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              {isMaster && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                  <Crown className="w-3 h-3" />
                  <span>MASTER</span>
                </span>
              )}
              <span>
                {isMaster ? 'Master Control Console' : appData.adminPanelConfig.panelSubtitle}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                  ? 'Published'
                  : saveStatus === 'error'
                  ? 'Save failed'
                  : hasUnsavedChanges
                  ? 'Unsaved edits'
                  : 'All changes synced'}
              </span>
            </div>
            <h2 className="font-serif text-xl font-semibold text-stone-950 dark:text-stone-50">
              {isMaster
                ? 'Master Event & Admin Configuration Console'
                : appData.adminPanelConfig.panelTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {canReset && (
              <>
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset Defaults</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-2.5 py-1.5 rounded-lg text-xs">
                    <span className="text-red-700 dark:text-red-300">Confirm reset?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await onResetDefault(sessionToken);
                        setConfirmReset(false);
                        if (res.ok) {
                          onPlaySound('chime');
                        } else {
                          onPlaySound('error');
                          setActionError(res.error || 'Reset failed.');
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-red-600 text-white font-medium cursor-pointer"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2 py-0.5 rounded text-stone-600 dark:text-stone-300 cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                onLockAdmin();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>

            <button
              type="button"
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Panel"
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {actionError && (
          <div className="px-5 sm:px-7 py-2.5 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => {
                onLockAdmin();
              }}
              className="underline font-medium cursor-pointer ml-4"
            >
              Re-unlock Session
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-7 py-2.5 bg-[#F5F1E8] dark:bg-stone-900/80 border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 overflow-x-auto shrink-0">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onPlaySound('tap');
                  setActiveTab(tab.id);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Editor Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-8">
          {/* EXCLUSIVE MASTER TAB: ADMIN PASSWORD & ADMIN PANEL CUSTOMIZATION */}
          {activeTab === 'master' && isMaster && (
            <div className="space-y-6">
              {/* 1. Change Admin Password */}
              <form
                onSubmit={handleUpdateMasterAdminPassword}
                className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-semibold">
                      Change Standard Admin Password
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Set a new password for the Organizer Admin Panel. Updating this immediately logs out older Admin sessions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">New Admin Password</label>
                    <input
                      type="password"
                      value={newAdminPwd}
                      onChange={(e) => setNewAdminPwd(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmAdminPwd}
                      onChange={(e) => setConfirmAdminPwd(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={pwdUpdating || !newAdminPwd.trim()}
                      className="w-full md:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 disabled:opacity-45 cursor-pointer"
                    >
                      {pwdUpdating ? 'Updating...' : 'Update Admin Password'}
                    </button>
                  </div>
                </div>

                {pwdFeedback && (
                  <p
                    className={`text-xs ${
                      pwdFeedback.type === 'ok'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {pwdFeedback.msg}
                  </p>
                )}
              </form>

              {/* 2. Customize & Control the Admin Panel */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-stone-200/70 dark:bg-stone-800 text-stone-800 dark:text-stone-200 flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-semibold">
                      Configure Standard Admin Panel
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Customize the Admin Panel&apos;s titles, login prompt, allowed editing tabs, and destructive permissions. Click &ldquo;Save Changes&rdquo; above to apply.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Admin Panel Title</label>
                    <input
                      type="text"
                      value={draft.adminPanelConfig.panelTitle}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ panelTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Admin Console Subtitle</label>
                    <input
                      type="text"
                      value={draft.adminPanelConfig.panelSubtitle}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ panelSubtitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Admin Lock Modal Title</label>
                    <input
                      type="text"
                      value={draft.adminPanelConfig.lockPromptTitle}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ lockPromptTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">
                      Admin Lock Modal Message
                    </label>
                    <input
                      type="text"
                      value={draft.adminPanelConfig.lockPromptMessage}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ lockPromptMessage: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>

                {/* Allowed Tabs Checkboxes */}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
                  <span className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Tabs Accessible to Standard Admin
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {ALL_ADMIN_TABS.map((t) => {
                      const checked = draft.adminPanelConfig.allowedTabs.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAllowedTab(t.id)}
                            className="accent-[var(--accent-primary)]"
                          />
                          <span>{t.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Permission Toggles */}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-5 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.adminPanelConfig.allowDeleteItems}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ allowDeleteItems: e.target.checked })
                      }
                      className="accent-[var(--accent-primary)]"
                    />
                    <span>Allow Standard Admin to delete notices, categories, matches &amp; teams</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.adminPanelConfig.allowResetDefaults}
                      onChange={(e) =>
                        handleUpdateAdminPanelConfig({ allowResetDefaults: e.target.checked })
                      }
                      className="accent-[var(--accent-primary)]"
                    />
                    <span>Allow Standard Admin to use &ldquo;Reset Defaults&rdquo;</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SITE, HERO, NAVIGATION & HEADERS */}
          {activeTab === 'site' && (
            <div className="space-y-6">
              {/* Hero & Event Header */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                <div>
                  <h3 className="font-serif text-base font-semibold">Hero Banner & Event Header</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Controls the landing hero title, dates line, main headline, subheadline, and primary buttons
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Hero Title</label>
                    <input
                      type="text"
                      value={draft.banner.heroTitle}
                      onChange={(e) => handleUpdateBanner({ heroTitle: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-stone-500 mb-1">Dates & Venue Eyebrow</label>
                    <input
                      type="text"
                      value={draft.banner.datesLabel}
                      onChange={(e) => handleUpdateBanner({ datesLabel: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Edition Kicker</label>
                    <input
                      type="text"
                      value={draft.banner.editionLabel}
                      onChange={(e) => handleUpdateBanner({ editionLabel: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-500 mb-1">Main Hero Headline</label>
                  <input
                    type="text"
                    value={draft.banner.headline}
                    onChange={(e) => handleUpdateBanner({ headline: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-500 mb-1">Hero Subheadline</label>
                  <textarea
                    rows={2}
                    value={draft.banner.subheadline}
                    onChange={(e) => handleUpdateBanner({ subheadline: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Primary CTA Button</label>
                    <input
                      type="text"
                      value={draft.siteCopy.heroPrimaryCtaLabel}
                      onChange={(e) =>
                        handleUpdateSiteCopy({ heroPrimaryCtaLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Secondary CTA Button</label>
                    <input
                      type="text"
                      value={draft.siteCopy.heroSecondaryCtaLabel}
                      onChange={(e) =>
                        handleUpdateSiteCopy({ heroSecondaryCtaLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Campus / Venues Label</label>
                    <input
                      type="text"
                      value={draft.banner.locationLabel}
                      onChange={(e) => handleUpdateBanner({ locationLabel: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
              </div>

              {/* Top Navigation Menu Labels */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                <div>
                  <h3 className="font-serif text-base font-semibold">Top Navigation Bar Labels</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Customize every menu item displayed in the persistent top toolbar
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Home Link</label>
                    <input
                      type="text"
                      value={draft.siteCopy.navHomeLabel}
                      onChange={(e) => handleUpdateSiteCopy({ navHomeLabel: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Rundown Link</label>
                    <input
                      type="text"
                      value={draft.siteCopy.navAnnouncementsLabel}
                      onChange={(e) =>
                        handleUpdateSiteCopy({ navAnnouncementsLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Match Result Link</label>
                    <input
                      type="text"
                      value={draft.siteCopy.navCompetitionsLabel}
                      onChange={(e) =>
                        handleUpdateSiteCopy({ navCompetitionsLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Leaderboard</label>
                    <input
                      type="text"
                      value={draft.siteCopy.navLeaderboardLabel}
                      onChange={(e) =>
                        handleUpdateSiteCopy({ navLeaderboardLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Settings Button</label>
                    <input
                      type="text"
                      value={draft.siteCopy.navSettingsLabel}
                      onChange={(e) => handleUpdateSiteCopy({ navSettingsLabel: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
              </div>

              {/* Home Portal Card Titles & Action Links */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                <div>
                  <h3 className="font-serif text-base font-semibold">Home Portal Cards</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Edit the section card headings and link labels on the Home landing page
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 1 Title</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeLeadNoticeTitle}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeLeadNoticeTitle: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 1 Link</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeLeadNoticeLinkLabel}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeLeadNoticeLinkLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 2 Title</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeUpcomingTitle}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeUpcomingTitle: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 2 Link</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeUpcomingLinkLabel}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeUpcomingLinkLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 3 Title</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeStandingsTitle}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeStandingsTitle: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 3 Link</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeStandingsLinkLabel}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeStandingsLinkLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 4 Title</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeCategoriesTitle}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeCategoriesTitle: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Card 4 Link</label>
                      <input
                        type="text"
                        value={draft.siteCopy.homeCategoriesLinkLabel}
                        onChange={(e) =>
                          handleUpdateSiteCopy({ homeCategoriesLinkLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dedicated Page Headers */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                <div>
                  <h3 className="font-serif text-base font-semibold">Subpage Eyebrows & Headings</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Edit the section headers on Rundown, Match Result, and Leaderboard pages
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      Rundown Page
                    </span>
                    <input
                      type="text"
                      value={draft.siteCopy.announcementsEyebrow}
                      placeholder="Eyebrow"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ announcementsEyebrow: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                    <input
                      type="text"
                      value={draft.siteCopy.announcementsHeading}
                      placeholder="Main Heading"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ announcementsHeading: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>

                  <div className="space-y-2 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      Match Result Page
                    </span>
                    <input
                      type="text"
                      value={draft.siteCopy.competitionsEyebrow}
                      placeholder="Eyebrow"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ competitionsEyebrow: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                    <input
                      type="text"
                      value={draft.siteCopy.competitionsHeading}
                      placeholder="Main Heading"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ competitionsHeading: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>

                  <div className="space-y-2 p-3 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      Leaderboard Page
                    </span>
                    <input
                      type="text"
                      value={draft.siteCopy.leaderboardEyebrow}
                      placeholder="Eyebrow"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ leaderboardEyebrow: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                    <input
                      type="text"
                      value={draft.siteCopy.leaderboardHeading}
                      placeholder="Main Heading"
                      onChange={(e) =>
                        handleUpdateSiteCopy({ leaderboardHeading: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
              </div>

              {/* Footer & Attribution */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                <div>
                  <h3 className="font-serif text-base font-semibold">Footer & Attribution</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Customize the footer brand text and the clickable credit label in the settings menu and footer
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Footer Brand Title</label>
                    <input
                      type="text"
                      value={draft.siteCopy.footerBrandTitle}
                      onChange={(e) => handleUpdateSiteCopy({ footerBrandTitle: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Footer Tagline</label>
                    <input
                      type="text"
                      value={draft.siteCopy.footerTagline}
                      onChange={(e) => handleUpdateSiteCopy({ footerTagline: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Credit Prefix</label>
                    <input
                      type="text"
                      value={draft.siteCopy.footerCreditPrefix}
                      onChange={(e) => handleUpdateSiteCopy({ footerCreditPrefix: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Clickable Admin Word</label>
                    <input
                      type="text"
                      value={draft.siteCopy.footerCreditBrand}
                      onChange={(e) => handleUpdateSiteCopy({ footerCreditBrand: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Credit Suffix</label>
                    <input
                      type="text"
                      value={draft.siteCopy.footerCreditSuffix}
                      onChange={(e) => handleUpdateSiteCopy({ footerCreditSuffix: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVENT RUNDOWN & SCHEDULE */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-semibold">
                    Event Rundown & Schedule ({draft.announcements.length})
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Create, pin on Home Rundown card, or edit daily schedule slots
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAnnouncement}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Schedule Slot</span>
                </button>
              </div>

              <div className="space-y-4">
                {draft.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ann.isFeatured}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { isFeatured: e.target.checked })
                          }
                          className="accent-[var(--accent-primary)]"
                        />
                        <span>Feature on Home Rundown Card</span>
                      </label>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-stone-500 mb-1">Session Title</label>
                        <input
                          type="text"
                          value={ann.title}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { title: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Category</label>
                        <input
                          type="text"
                          value={ann.category}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { category: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Session Tag</label>
                        <select
                          value={ann.priority}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, {
                              priority: e.target.value as AnnouncementPriority,
                            })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        >
                          <option value="Ceremony">Ceremony</option>
                          <option value="Briefing">Briefing</option>
                          <option value="Match">Match</option>
                          <option value="Finals">Finals</option>
                          <option value="Important">Important</option>
                          <option value="Schedule Update">Schedule Update</option>
                          <option value="Results">Results</option>
                          <option value="Bulletin">Bulletin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Status</label>
                        <select
                          value={ann.scheduleStatus || 'Upcoming'}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, {
                              scheduleStatus: e.target.value as RundownStatus,
                            })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        >
                          <option value="Upcoming">Upcoming</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Day Label</label>
                        <input
                          type="text"
                          value={ann.dayLabel || ''}
                          placeholder="e.g. Day 2 · Fri, Nov 20"
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { dayLabel: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Time Slot</label>
                        <input
                          type="text"
                          value={ann.timeRange || ''}
                          placeholder="e.g. 08:30 – 10:00"
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { timeRange: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Venue</label>
                        <input
                          type="text"
                          value={ann.venue}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { venue: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Coordinator / PIC</label>
                        <input
                          type="text"
                          value={ann.author}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { author: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">
                          Date Stamp (Fallback)
                        </label>
                        <input
                          type="text"
                          value={ann.date}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { date: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-stone-500 mb-1">Short Summary</label>
                        <input
                          type="text"
                          value={ann.summary}
                          onChange={(e) =>
                            handleUpdateAnnouncement(ann.id, { summary: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-stone-500 mb-1">
                        Full Schedule Instructions & Notes
                      </label>
                      <textarea
                        rows={3}
                        value={ann.body}
                        onChange={(e) =>
                          handleUpdateAnnouncement(ann.id, { body: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BRACKETS, UPCOMING MATCHES & MATCH EVENTS */}
          {activeTab === 'brackets' && activeCat && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {draft.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCatId(cat.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        cat.id === activeCat.id
                          ? 'bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                          : 'bg-white dark:bg-[#1C1917] border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>

              {/* Category Metadata */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-base font-semibold">
                    Category Details — {activeCat.name}
                  </h3>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={draft.categories.length <= 1}
                      onClick={() => handleDeleteCategory(activeCat.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Category</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Category Name</label>
                    <input
                      type="text"
                      value={activeCat.name}
                      onChange={(e) =>
                        handleUpdateCategoryMeta(activeCat.id, { name: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Primary Venue</label>
                    <input
                      type="text"
                      value={activeCat.venue}
                      onChange={(e) =>
                        handleUpdateCategoryMeta(activeCat.id, { venue: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Format Summary</label>
                    <input
                      type="text"
                      value={activeCat.format}
                      onChange={(e) =>
                        handleUpdateCategoryMeta(activeCat.id, { format: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Schedule Window</label>
                    <input
                      type="text"
                      value={activeCat.scheduleWindow}
                      onChange={(e) =>
                        handleUpdateCategoryMeta(activeCat.id, { scheduleWindow: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={activeCat.tagline}
                    onChange={(e) =>
                      handleUpdateCategoryMeta(activeCat.id, { tagline: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Category Description</label>
                  <textarea
                    rows={2}
                    value={activeCat.description}
                    onChange={(e) =>
                      handleUpdateCategoryMeta(activeCat.id, { description: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>
              </div>

              {/* Bracket & Upcoming Matches Editor */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg font-semibold">
                      Bracket &amp; Upcoming Fixtures ({activeCat.matches.length})
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Choosing a winner advances that team automatically; add scorers (&ldquo;Goal by&rdquo;) and MVPs to show when clicked.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddMatch(activeCat.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Match</span>
                  </button>
                </div>

                <datalist id="match-event-presets">
                  {EVENT_TYPE_PRESETS.map((preset) => (
                    <option key={preset} value={preset} />
                  ))}
                </datalist>

                {activeCat.matches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-4 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={match.round}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              round: e.target.value as BracketRound,
                            })
                          }
                          className="px-2 py-1 text-xs font-medium rounded-md bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                        >
                          <option value="Qualifying Round">Qualifying Round</option>
                          <option value="Quarterfinals">Quarterfinals</option>
                          <option value="Semifinals">Semifinals</option>
                          <option value="Final">Final</option>
                        </select>
                        <label className="inline-flex items-center gap-1 text-xs text-stone-500">
                          <span>Match #</span>
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={match.matchOrder}
                            onChange={(e) =>
                              handleUpdateMatch(activeCat.id, match.id, {
                                matchOrder: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-12 px-1.5 py-0.5 text-xs font-mono rounded-md bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={match.status}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              status: e.target.value as MatchStatus,
                            })
                          }
                          className="px-2.5 py-1 text-xs rounded-md bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                        >
                          <option value="Upcoming">Upcoming</option>
                          <option value="Live">Live</option>
                          <option value="Completed">Completed</option>
                        </select>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(activeCat.id, match.id)}
                            aria-label="Delete match"
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Teams & Scores */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className="block text-xs text-stone-500 mb-1">Team A</label>
                        <select
                          value={match.teamAId || ''}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              teamAId: e.target.value || null,
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        >
                          <option value="">TBD (Unassigned)</option>
                          {draft.teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.shortCode})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs text-stone-500 mb-1">Score A</label>
                        <input
                          type="number"
                          placeholder="—"
                          value={match.scoreA ?? ''}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              scoreA: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-xs text-stone-500 mb-1">Team B</label>
                        <select
                          value={match.teamBId || ''}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              teamBId: e.target.value || null,
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        >
                          <option value="">TBD (Unassigned)</option>
                          {draft.teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.shortCode})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs text-stone-500 mb-1">Score B</label>
                        <input
                          type="number"
                          placeholder="—"
                          value={match.scoreB ?? ''}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, {
                              scoreB: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    {/* Schedule & Official Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Date</label>
                        <input
                          type="text"
                          value={match.date}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { date: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Kickoff / Time</label>
                        <input
                          type="text"
                          value={match.time}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { time: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Venue</label>
                        <input
                          type="text"
                          value={match.venue}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { venue: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Official / Referee</label>
                        <input
                          type="text"
                          value={match.referee || ''}
                          placeholder="e.g. Mr. Hendra"
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { referee: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Match MVP</label>
                        <input
                          type="text"
                          value={match.mvp || ''}
                          placeholder="e.g. Rafi Pratama (XII-A)"
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { mvp: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Short Card Note</label>
                        <input
                          type="text"
                          value={match.note || ''}
                          onChange={(e) =>
                            handleUpdateMatch(activeCat.id, match.id, { note: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-stone-500 mb-1">
                        Match Breakdown Summary
                      </label>
                      <input
                        type="text"
                        value={match.summary || ''}
                        placeholder="Brief match recap shown when clicking this bracket fixture..."
                        onChange={(e) =>
                          handleUpdateMatch(activeCat.id, match.id, { summary: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>

                    {/* Match Events Editor ("Goal by", etc.) */}
                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                          Match Highlights &amp; Events ({match.events?.length || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddMatchEvent(activeCat.id, match.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Goal / Event</span>
                        </button>
                      </div>

                      {(match.events || []).map((ev) => (
                        <div
                          key={ev.id}
                          className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-stone-50/80 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800"
                        >
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              list="match-event-presets"
                              value={ev.type}
                              placeholder="Goal by"
                              onChange={(e) =>
                                handleUpdateMatchEvent(activeCat.id, match.id, ev.id, {
                                  type: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              value={ev.player}
                              placeholder="Player / Scorer"
                              onChange={(e) =>
                                handleUpdateMatchEvent(activeCat.id, match.id, ev.id, {
                                  player: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <select
                              value={ev.teamSide}
                              onChange={(e) =>
                                handleUpdateMatchEvent(activeCat.id, match.id, ev.id, {
                                  teamSide: e.target.value as 'A' | 'B',
                                })
                              }
                              className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                            >
                              <option value="A">Team A</option>
                              <option value="B">Team B</option>
                            </select>
                          </div>
                          <div className="sm:col-span-1">
                            <input
                              type="text"
                              value={ev.minuteOrStage}
                              placeholder="12'"
                              onChange={(e) =>
                                handleUpdateMatchEvent(activeCat.id, match.id, ev.id, {
                                  minuteOrStage: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs font-mono rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-2">
                            <input
                              type="text"
                              value={ev.detail || ''}
                              placeholder="Note (optional)"
                              onChange={(e) =>
                                handleUpdateMatchEvent(activeCat.id, match.id, ev.id, {
                                  detail: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteMatchEvent(activeCat.id, match.id, ev.id)}
                              aria-label="Remove match event"
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Declare Winner */}
                    <div className="pt-2 flex flex-wrap items-center gap-2 text-xs border-t border-stone-100 dark:border-stone-800">
                      <span className="text-stone-500">Declare Winner &amp; Advance:</span>
                      <button
                        type="button"
                        disabled={!match.teamAId}
                        onClick={() => {
                          onPlaySound('tap');
                          handleUpdateMatch(
                            activeCat.id,
                            match.id,
                            { winnerId: match.teamAId, status: 'Completed' },
                            match.teamAId
                          );
                        }}
                        className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                          match.winnerId && match.winnerId === match.teamAId
                            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        Team A Advances
                      </button>
                      <button
                        type="button"
                        disabled={!match.teamBId}
                        onClick={() => {
                          onPlaySound('tap');
                          handleUpdateMatch(
                            activeCat.id,
                            match.id,
                            { winnerId: match.teamBId, status: 'Completed' },
                            match.teamBId
                          );
                        }}
                        className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                          match.winnerId && match.winnerId === match.teamBId
                            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        Team B Advances
                      </button>
                      {match.winnerId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateMatch(
                              activeCat.id,
                              match.id,
                              { winnerId: null, status: 'Upcoming' },
                              null
                            )
                          }
                          className="px-2.5 py-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer"
                        >
                          Clear Winner
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LEADERBOARDS */}
          {activeTab === 'leaderboards' && activeLb && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {draft.leaderboards.map((lb) => (
                    <button
                      key={lb.id}
                      type="button"
                      onClick={() => setSelectedLbId(lb.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        lb.id === activeLb.id
                          ? 'bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                          : 'bg-white dark:bg-[#1C1917] border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {lb.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddLeaderboardGame}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Game Leaderboard</span>
                </button>
              </div>

              {/* Leaderboard Config */}
              <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-base font-semibold">
                    Leaderboard Settings — {activeLb.name}
                  </h3>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={draft.leaderboards.length <= 1}
                      onClick={() => handleDeleteLeaderboardGame(activeLb.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Leaderboard</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Leaderboard Title</label>
                    <input
                      type="text"
                      value={activeLb.name}
                      onChange={(e) => handleUpdateLbMeta(activeLb.id, { name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Table Type</label>
                    <select
                      value={activeLb.gameType}
                      onChange={(e) =>
                        handleUpdateLbMeta(activeLb.id, {
                          gameType: e.target.value as LeaderboardGame['gameType'],
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    >
                      <option value="medal-tally">Medal &amp; Points Tally</option>
                      <option value="match-table">Match W/D/L Table</option>
                      <option value="points-ranking">Score / Points Ranking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Detail Column Label</label>
                    <input
                      type="text"
                      value={activeLb.detailColumnLabel}
                      onChange={(e) =>
                        handleUpdateLbMeta(activeLb.id, { detailColumnLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Score Column Label</label>
                    <input
                      type="text"
                      value={activeLb.metricLabel}
                      onChange={(e) =>
                        handleUpdateLbMeta(activeLb.id, { metricLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Subtitle Description</label>
                  <input
                    type="text"
                    value={activeLb.subtitle}
                    onChange={(e) => handleUpdateLbMeta(activeLb.id, { subtitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>
              </div>

              {/* Entries Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-semibold">
                    Standings Rows ({activeLb.entries.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleAddLbEntry(activeLb.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contender Row</span>
                  </button>
                </div>

                {activeLb.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2.5 items-end"
                  >
                    <div className="col-span-2">
                      <label className="block text-[11px] text-stone-500 mb-1">
                        Class / Player
                      </label>
                      <input
                        type="text"
                        value={entry.participantName}
                        onChange={(e) =>
                          handleUpdateLbEntry(activeLb.id, entry.id, {
                            participantName: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Played</label>
                      <input
                        type="number"
                        value={entry.played}
                        onChange={(e) =>
                          handleUpdateLbEntry(activeLb.id, entry.id, {
                            played: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>

                    {activeLb.gameType === 'medal-tally' ? (
                      <>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Gold</label>
                          <input
                            type="number"
                            value={entry.gold}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                gold: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Silver</label>
                          <input
                            type="number"
                            value={entry.silver}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                silver: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Bronze</label>
                          <input
                            type="number"
                            value={entry.bronze}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                bronze: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Won</label>
                          <input
                            type="number"
                            value={entry.won}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                won: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Drawn</label>
                          <input
                            type="number"
                            value={entry.drawn}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                drawn: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-500 mb-1">Lost</label>
                          <input
                            type="number"
                            value={entry.lost}
                            onChange={(e) =>
                              handleUpdateLbEntry(activeLb.id, entry.id, {
                                lost: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                      </>
                    )}

                    <div className="col-span-2 lg:col-span-1">
                      <label className="block text-[11px] text-stone-500 mb-1">Detail</label>
                      <input
                        type="text"
                        value={entry.metricDetail}
                        onChange={(e) =>
                          handleUpdateLbEntry(activeLb.id, entry.id, {
                            metricDetail: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>

                    <div className="flex items-end gap-1.5">
                      <div className="flex-1">
                        <label className="block text-[11px] text-stone-500 mb-1">Points</label>
                        <input
                          type="number"
                          step="0.5"
                          value={entry.points}
                          onChange={(e) =>
                            handleUpdateLbEntry(activeLb.id, entry.id, {
                              points: Number(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLbEntry(activeLb.id, entry.id)}
                          aria-label="Delete row"
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: TEAMS */}
          {activeTab === 'teams' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-semibold">
                    Participating Classes &amp; Squads ({draft.teams.length})
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Manage class names, short codes, captains, and mottoes referenced in brackets
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTeam}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class Team</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {draft.teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-stone-400">{team.shortCode}</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <label className="block text-[11px] text-stone-500 mb-1">Team Name</label>
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleUpdateTeam(team.id, { name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-500 mb-1">Short Code</label>
                        <input
                          type="text"
                          value={team.shortCode}
                          onChange={(e) => handleUpdateTeam(team.id, { shortCode: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-stone-500 mb-1">Grade / Cohort</label>
                        <input
                          type="text"
                          value={team.cohort}
                          onChange={(e) => handleUpdateTeam(team.id, { cohort: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-stone-500 mb-1">Captain</label>
                        <input
                          type="text"
                          value={team.captain}
                          onChange={(e) => handleUpdateTeam(team.id, { captain: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Class Motto</label>
                      <input
                        type="text"
                        value={team.motto}
                        onChange={(e) => handleUpdateTeam(team.id, { motto: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
