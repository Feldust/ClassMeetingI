import React, { useEffect, useRef } from 'react';
import { SlidersHorizontal, Sun, Moon, Volume2, VolumeX, Heart, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { SiteCopyConfig, UISettings } from '../types';
import { playUISound } from '../utils/sound';

export type PageRoute = 'home' | 'announcements' | 'competitions' | 'leaderboard';

interface NavbarAndSettingsProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute, categoryId?: string) => void;
  siteCopy: SiteCopyConfig;
  settings: UISettings;
  onUpdateSettings: (patch: Partial<UISettings>) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onClickCKDAdmin: () => void;
  isAdminUnlocked: boolean;
  authRole?: 'admin' | 'master' | null;
}


export const NavbarAndSettings: React.FC<NavbarAndSettingsProps> = ({
  currentPage,
  onNavigate,
  siteCopy,
  settings,
  onUpdateSettings,
  isSettingsOpen,
  setIsSettingsOpen,
  onClickCKDAdmin,
  isAdminUnlocked,
  authRole,
}) => {
  const navItems: { id: PageRoute; label: string }[] = [
    { id: 'home', label: siteCopy.navHomeLabel },
    { id: 'announcements', label: siteCopy.navAnnouncementsLabel },
    { id: 'competitions', label: siteCopy.navCompetitionsLabel },
    { id: 'leaderboard', label: siteCopy.navLeaderboardLabel },
  ];
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!isSettingsOpen) return;
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsSettingsOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSettingsOpen, setIsSettingsOpen]);

  const isSmooth = settings.motionPreference === 'smooth';

  return (
    <>
      {/* temukolese.org-inspired sticky Cinzel toolbar */}
      <header className="sticky top-0 z-40 w-full bg-[#FBF9F5]/95 dark:bg-black/95 backdrop-blur-md border-b border-stone-200/90 dark:border-white/12 transition-colors duration-200">
        <div className="w-full px-4 sm:px-6 md:px-[5vw] min-h-[72px] py-3 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-center md:justify-start gap-x-5 gap-y-1.5 md:gap-7 lg:gap-11 font-['Cinzel',Georgia,serif]">
          {/* Navigation Menu Links */}
          <nav
            aria-label="Primary Navigation"
            className="flex flex-wrap md:flex-nowrap items-center justify-center gap-x-4 sm:gap-x-6 md:gap-7 lg:gap-11"
          >
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <a
                  key={item.id}
                  href={
                    item.id === 'home'
                      ? '/'
                      : item.id === 'announcements'
                      ? '/rundown'
                      : item.id === 'competitions'
                      ? '/match-result'
                      : `/${item.id}`
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    playUISound('tap', settings.soundEnabled, settings.soundVolume);
                    onNavigate(item.id);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center justify-center h-8 md:h-[72px] text-[10px] sm:text-xs md:text-[13px] font-semibold tracking-[1px] md:tracking-[1.5px] whitespace-nowrap shrink-0 transition-colors duration-250 after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0.5 md:after:bottom-[16px] after:h-[1px] after:bg-stone-900 dark:after:bg-white after:origin-center after:transition-transform after:duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xs ${
                    isActive
                      ? 'text-[#a3761e] dark:text-[#e5c76b] after:scale-x-100'
                      : 'text-stone-800 dark:text-white hover:text-[#a3761e] dark:hover:text-[#e5c76b] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Far-Right Utility Action: Settings Button */}
          <div className="md:ml-auto flex items-center shrink-0">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => {
                playUISound('switch', settings.soundEnabled, settings.soundVolume);
                setIsSettingsOpen((prev) => !prev);
              }}
              aria-expanded={isSettingsOpen}
              aria-haspopup="dialog"
              className={`relative flex items-center justify-center gap-2 h-8 md:h-[72px] text-[10px] sm:text-xs md:text-[13px] font-semibold tracking-[1px] md:tracking-[1.5px] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-250 after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0.5 md:after:bottom-[16px] after:h-[1px] after:bg-stone-900 dark:after:bg-white after:origin-center after:transition-transform after:duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xs ${
                isSettingsOpen
                  ? 'text-[#a3761e] dark:text-[#e5c76b] after:scale-x-100'
                  : 'text-stone-800 dark:text-white hover:text-[#a3761e] dark:hover:text-[#e5c76b] after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{siteCopy.navSettingsLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Top-Right Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Website UI Settings"
            initial={isSmooth ? { opacity: 0, y: -8, scale: 0.98 } : { opacity: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isSmooth ? { opacity: 0, y: -6, scale: 0.98 } : { opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[4.8rem] right-4 sm:right-[5vw] z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-white dark:bg-[#0c0a09] border border-stone-200 dark:border-[#2e2823] shadow-2xl p-5 text-stone-900 dark:text-stone-100"
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-200/80 dark:border-stone-800">
              <div>
                <h2 className="font-['Cinzel',Georgia,serif] text-base font-semibold tracking-wide">
                  Interface Settings
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Personalize theme, sound, and reading comfort
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close settings"
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-5">
              {/* Light & Dark Mode */}
              <div>
                <span className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">
                  Appearance Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      playUISound('switch', settings.soundEnabled, settings.soundVolume);
                      onUpdateSettings({ theme: 'light' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      settings.theme === 'light'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Warm Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playUISound('switch', settings.soundEnabled, settings.soundVolume);
                      onUpdateSettings({ theme: 'dark' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      settings.theme === 'dark'
                        ? 'bg-[#1a1613] text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Obsidian Dark</span>
                  </button>
                </div>
              </div>

              {/* Sound Settings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    Interface Sound
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !settings.soundEnabled;
                      onUpdateSettings({ soundEnabled: next });
                      if (next) {
                        playUISound('chime', true, settings.soundVolume);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      settings.soundEnabled
                        ? 'border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                        : 'border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {settings.soundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound On</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Muted</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    disabled={!settings.soundEnabled}
                    value={settings.soundVolume}
                    aria-label="Sound volume"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateSettings({ soundVolume: val });
                    }}
                    onMouseUp={() => playUISound('tap', settings.soundEnabled, settings.soundVolume)}
                    className="w-full accent-[var(--accent-primary)] disabled:opacity-40 cursor-pointer"
                  />
                  <span className="font-mono tabular-nums text-xs text-stone-500 dark:text-stone-400 w-9 text-right">
                    {Math.round(settings.soundVolume * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Signature Attribution with Clickable CKD Admin Trigger */}
            <div className="pt-3.5 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <div className="flex items-center gap-1">
                <span>{siteCopy.footerCreditPrefix}</span>
                <button
                  type="button"
                  onClick={() => {
                    playUISound('tap', settings.soundEnabled, settings.soundVolume);
                    setIsSettingsOpen(false);
                    onClickCKDAdmin();
                  }}
                  title="Access CKD Admin Panel"
                  className="font-semibold text-stone-900 dark:text-stone-100 underline decoration-stone-400 dark:decoration-stone-600 underline-offset-2 hover:text-[var(--accent-text)] hover:decoration-[var(--accent-primary)] transition-colors px-1 py-0.5 rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {siteCopy.footerCreditBrand}
                </button>
                <span>{siteCopy.footerCreditSuffix}</span>
                <Heart className="w-3 h-3 text-rose-600/80 dark:text-rose-400/80 ml-0.5 fill-current" aria-hidden="true" />
              </div>

              {isAdminUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    playUISound('tap', settings.soundEnabled, settings.soundVolume);
                    setIsSettingsOpen(false);
                    onClickCKDAdmin();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{authRole === 'master' ? 'Master Active' : 'Admin Active'}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
