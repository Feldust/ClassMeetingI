import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, ShieldCheck, Crown } from 'lucide-react';
import { useTournamentStore, useUISettings } from './hooks/useTournamentStore';
import { NavbarAndSettings, type PageRoute } from './components/NavbarAndSettings';
import { HomeView } from './components/HomeView';
import { AnnouncementsSection } from './components/AnnouncementsSection';
import { CompetitionsSection } from './components/CompetitionsSection';
import { LeaderboardSection } from './components/LeaderboardSection';
import { AdminModal } from './components/AdminModal';
import { playUISound, type SoundKind } from './utils/sound';
import type { AuthRole } from './types';

function parseRouteFromPath(pathname: string): PageRoute {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/rundown' || clean === '/announcements') return 'announcements';
  if (clean === '/match-result' || clean === '/competitions') return 'competitions';
  if (clean === '/leaderboard') return 'leaderboard';
  return 'home';
}

function pathForRoute(page: PageRoute): string {
  if (page === 'home') return '/';
  if (page === 'announcements') return '/rundown';
  if (page === 'competitions') return '/match-result';
  return `/${page}`;
}

export function App() {
  const { settings, updateSettings } = useUISettings();
  const { data, saveStatus, persistData, resetToDefault, changeAdminPassword } =
    useTournamentStore();

  const [currentPage, setCurrentPage] = useState<PageRoute>(() =>
    parseRouteFromPath(window.location.pathname)
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [sessionToken, setSessionToken] = useState('');

  // Support browser back/forward navigation between dedicated pages
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (page: PageRoute, categoryId?: string) => {
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
    setCurrentPage(page);
    const targetPath = pathForRoute(page);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page }, '', targetPath);
    }
    window.scrollTo({
      top: 0,
      behavior: settings.motionPreference === 'smooth' ? 'smooth' : 'auto',
    });
  };

  const triggerSound = (kind: SoundKind = 'tap') => {
    playUISound(kind, settings.soundEnabled, settings.soundVolume);
  };

  const isSmooth = settings.motionPreference === 'smooth';
  const isUnlocked = authRole !== null && Boolean(sessionToken);

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#000000] text-stone-900 dark:text-stone-100 transition-colors duration-300">
      {/* Persistent temukolese.org-inspired Cinzel Top Menu Bar & Floating Top-Right Settings */}
      <NavbarAndSettings
        currentPage={currentPage}
        onNavigate={handleNavigate}
        siteCopy={data.siteCopy}
        settings={settings}
        onUpdateSettings={updateSettings}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        onClickCKDAdmin={() => setIsAdminModalOpen(true)}
        isAdminUnlocked={isUnlocked}
        authRole={authRole}
      />

      {/* Multi-Page Content Area with Gentle Fade-In Entrance & Page Transitions */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={isSmooth ? { opacity: 0, y: 12 } : { opacity: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={isSmooth ? { opacity: 0, y: -8 } : { opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentPage === 'home' && (
              <HomeView
                data={data}
                compact={settings.compactDensity}
                onNavigate={handleNavigate}
                onSoundTap={() => triggerSound('tap')}
              />
            )}

            {currentPage === 'announcements' && (
              <AnnouncementsSection
                announcements={data.announcements}
                compact={settings.compactDensity}
                eyebrow={data.siteCopy.announcementsEyebrow}
                heading={data.siteCopy.announcementsHeading}
                onSoundTap={() => triggerSound('tap')}
              />
            )}

            {currentPage === 'competitions' && (
              <CompetitionsSection
                categories={data.categories}
                teams={data.teams}
                compact={settings.compactDensity}
                initialCategoryId={selectedCategoryId}
                eyebrow={data.siteCopy.competitionsEyebrow}
                heading={data.siteCopy.competitionsHeading}
                onSoundTap={() => triggerSound('tap')}
              />
            )}

            {currentPage === 'leaderboard' && (
              <LeaderboardSection
                leaderboards={data.leaderboards}
                compact={settings.compactDensity}
                eyebrow={data.siteCopy.leaderboardEyebrow}
                heading={data.siteCopy.leaderboardHeading}
                onSoundTap={() => triggerSound('tap')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Quiet Minimalist Editorial Footer */}
      <footer className="mt-16 border-t border-stone-200/80 dark:border-white/10 bg-[#F7F4EE] dark:bg-[#080706]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-9 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['Cinzel',Georgia,serif] text-sm font-semibold tracking-wider text-stone-800 dark:text-stone-200">
              {data.siteCopy.footerBrandTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>{data.siteCopy.footerTagline}</span>
          </div>

          <div className="flex items-center gap-1">
            <span>{data.siteCopy.footerCreditPrefix}</span>
            <button
              type="button"
              onClick={() => {
                triggerSound('tap');
                setIsAdminModalOpen(true);
              }}
              title="Open CKD Admin / Master Panel"
              className="font-semibold text-stone-900 dark:text-stone-100 underline decoration-stone-400 dark:decoration-stone-600 underline-offset-2 hover:text-[var(--accent-text)] transition-colors px-1 py-0.5 rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {data.siteCopy.footerCreditBrand}
            </button>
            <span>{data.siteCopy.footerCreditSuffix}</span>
            <Heart
              className="w-3 h-3 text-rose-600/80 dark:text-rose-400/80 ml-0.5 fill-current"
              aria-hidden="true"
            />
          </div>
        </div>
      </footer>

      {/* Quick Re-Open Floating Button when Organizer or Master Session is Unlocked */}
      {isUnlocked && !isAdminModalOpen && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => {
              triggerSound('tap');
              setIsAdminModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 shadow-lg text-xs font-medium hover:opacity-95 transition-opacity cursor-pointer"
          >
            {authRole === 'master' ? (
              <Crown className="w-4 h-4 text-amber-400 dark:text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{authRole === 'master' ? 'Open Master Panel' : 'Open CKD Admin'}</span>
          </button>
        </div>
      )}

      {/* Password-Protected CKD Admin & Master Panel */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        isUnlocked={isUnlocked}
        authRole={authRole}
        sessionToken={sessionToken}
        onUnlockSuccess={(role, token) => {
          setAuthRole(role);
          setSessionToken(token);
        }}
        onLockAdmin={() => {
          setAuthRole(null);
          setSessionToken('');
        }}
        appData={data}
        saveStatus={saveStatus}
        onSaveData={persistData}
        onResetDefault={resetToDefault}
        onChangeAdminPassword={changeAdminPassword}
        onPlaySound={triggerSound}
      />
    </div>
  );
}

export default App;
