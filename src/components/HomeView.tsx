import React, { useMemo } from 'react';
import { ArrowRight, Calendar, Clock, MapPin, Award, BarChart3, GitBranch } from 'lucide-react';
import type { AppDataState } from '../types';
import type { PageRoute } from './NavbarAndSettings';

interface HomeViewProps {
  data: AppDataState;
  compact: boolean;
  onNavigate: (page: PageRoute, categoryId?: string) => void;
  onSoundTap: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  data,
  compact,
  onNavigate,
  onSoundTap,
}) => {
  const teamMap = useMemo(() => new Map(data.teams.map((t) => [t.id, t])), [data.teams]);

  const featuredAnnouncement = useMemo(() => {
    return data.announcements.find((a) => a.isFeatured) || data.announcements[0] || null;
  }, [data.announcements]);

  const nextMatches = useMemo(() => {
    const upcoming: {
      id: string;
      categoryId: string;
      categoryName: string;
      round: string;
      teamA: string;
      teamB: string;
      date: string;
      time: string;
      venue: string;
    }[] = [];

    for (const cat of data.categories) {
      for (const m of cat.matches) {
        if (m.status === 'Upcoming' || m.status === 'Live') {
          upcoming.push({
            id: m.id,
            categoryId: cat.id,
            categoryName: cat.name,
            round: m.round,
            teamA: m.teamAId ? teamMap.get(m.teamAId)?.name || m.teamAId : 'TBD',
            teamB: m.teamBId ? teamMap.get(m.teamBId)?.name || m.teamBId : 'TBD',
            date: m.date,
            time: m.time,
            venue: m.venue,
          });
        }
      }
    }
    return upcoming.slice(0, 4);
  }, [data.categories, teamMap]);

  const topStandings = useMemo(() => {
    const overall = data.leaderboards[0];
    if (!overall) return [];
    return [...overall.entries].sort((a, b) => b.points - a.points).slice(0, 4);
  }, [data.leaderboards]);

  return (
    <div>
      {/* TEMUKOLESE.ORG-INSPIRED CENTERED CEREMONIAL HERO SECTION */}
      <section className={`relative isolate overflow-hidden ${compact ? 'pt-10 pb-12' : 'pt-14 sm:pt-20 pb-16 sm:pb-20'}`}>
        {/* Subtle Warm Radial Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-12 mx-auto h-[340px] max-w-4xl bg-[radial-gradient(ellipse_at_50%_45%,rgba(231,90,22,0.09),rgba(248,185,71,0.05)_42%,transparent_72%)] dark:bg-[radial-gradient(ellipse_at_50%_45%,rgba(231,90,22,0.16),rgba(248,185,71,0.06)_42%,transparent_70%)] -z-10"
        />

        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="mb-5 flex flex-col items-center">
            <span className="font-['Cinzel',Georgia,serif] text-2xl sm:text-3xl font-bold tracking-[0.22em] text-stone-950 dark:text-white">
              {data.banner.heroTitle}
            </span>
          </div>

          {/* Centered Cinzel Date & Venue Eyebrow (matches 12-16 OKTOBER 2026 • SMA KOLESE LOYOLA • SEMARANG) */}
          <p className="font-['Cinzel',Georgia,serif] font-semibold text-xs sm:text-sm md:text-base tracking-[2.2px] text-[#9A7B2C] dark:text-[#a38735] uppercase text-balance">
            {data.banner.datesLabel}
          </p>

          {/* Ceremonial Headline */}
          <h1 className="font-['Cinzel',Georgia,serif] text-2xl sm:text-4xl lg:text-[42px] font-normal tracking-[2px] leading-[1.35] text-stone-900 dark:text-white mt-5 max-w-3xl text-balance">
            {data.banner.headline}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
            {data.banner.subheadline}
          </p>

          {/* Primary Actions Routing to Dedicated Pages */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                onSoundTap();
                onNavigate('competitions');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 text-xs font-['Cinzel',Georgia,serif] font-semibold tracking-[1.5px] uppercase rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{data.siteCopy.heroPrimaryCtaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onSoundTap();
                onNavigate('announcements');
              }}
              className="inline-flex items-center gap-2 px-5 py-3 text-xs font-['Cinzel',Georgia,serif] font-semibold tracking-[1.5px] uppercase rounded-lg border border-stone-300 dark:border-[#2e2823] bg-white/80 dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 hover:border-stone-500 dark:hover:border-amber-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{data.siteCopy.heroSecondaryCtaLabel}</span>
            </button>
          </div>
        </div>
      </section>

      {/* MULTI-PAGE PORTAL HIGHLIGHTS BELOW HERO */}
      <section className="py-12 border-t border-stone-200/80 dark:border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Featured Rundown Slot Card -> links to /rundown */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0c0a09] border border-stone-200/90 dark:border-[#2e2823] p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-1.5 font-['Cinzel',Georgia,serif] font-semibold tracking-wider text-[var(--accent-text)]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{data.siteCopy.homeLeadNoticeTitle}</span>
                </span>
                <span className="font-mono tabular-nums">
                  {featuredAnnouncement?.dayLabel || featuredAnnouncement?.date || 'Scheduled'}
                </span>
              </div>

              {featuredAnnouncement ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    {featuredAnnouncement.timeRange && (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-stone-800 dark:text-stone-200 font-medium">
                        <Clock className="w-3 h-3 text-[var(--accent-text)]" />
                        <span>{featuredAnnouncement.timeRange}</span>
                      </span>
                    )}
                    {featuredAnnouncement.timeRange && <span aria-hidden="true">·</span>}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{featuredAnnouncement.venue}</span>
                    </span>
                  </div>
                  <h2 className="font-serif text-xl sm:text-2xl font-medium text-stone-950 dark:text-stone-50 mt-2 text-balance">
                    {featuredAnnouncement.title}
                  </h2>
                  <p className="text-sm text-stone-600 dark:text-stone-400 mt-2.5 leading-relaxed">
                    {featuredAnnouncement.summary}
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone-500 mt-3">No rundown sessions posted yet.</p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {data.announcements.length} {data.siteCopy.homeSessionsCountLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSoundTap();
                  onNavigate('announcements');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 hover:text-[var(--accent-text)] transition-colors cursor-pointer"
              >
                <span>{data.siteCopy.homeLeadNoticeLinkLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Quick Categories & Next Fixtures -> links to /competitions */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0c0a09] border border-stone-200/90 dark:border-[#2e2823] p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-stone-100 dark:border-stone-800/80">
                <span className="inline-flex items-center gap-1.5 text-xs font-['Cinzel',Georgia,serif] font-semibold tracking-wider text-[var(--accent-text)]">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{data.siteCopy.homeUpcomingTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSoundTap();
                    onNavigate('competitions');
                  }}
                  className="text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{data.siteCopy.homeUpcomingLinkLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Category Shortcuts */}
              <div className="mt-4 flex flex-wrap gap-2">
                {data.categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSoundTap();
                      onNavigate('competitions', cat.id);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Upcoming Preview List */}
              <div className="mt-4 divide-y divide-stone-100 dark:divide-stone-800/80">
                {nextMatches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSoundTap();
                      onNavigate('competitions', m.categoryId);
                    }}
                    className="w-full py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left hover:bg-stone-50/70 dark:hover:bg-stone-900/40 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">
                        {m.categoryName} · {m.round}
                      </span>
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        {m.teamA}{' '}
                        <span className="text-stone-400 mx-1">{data.siteCopy.homeVersusLabel}</span>{' '}
                        {m.teamB}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {m.date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {m.time}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 2-Column Portal Row: Standings Snapshot + Past Champions Archive */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white dark:bg-[#0c0a09] border border-stone-200/90 dark:border-[#2e2823] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800/80">
                <span className="inline-flex items-center gap-1.5 text-xs font-['Cinzel',Georgia,serif] font-semibold tracking-wider text-[var(--accent-text)]">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{data.siteCopy.homeStandingsTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSoundTap();
                    onNavigate('leaderboard');
                  }}
                  className="text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{data.siteCopy.homeStandingsLinkLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800/80">
                {topStandings.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums text-xs text-stone-400 w-5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-medium text-stone-900 dark:text-stone-100">
                        {entry.participantName}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {entry.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0c0a09] border border-stone-200/90 dark:border-[#2e2823] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800/80">
                <span className="inline-flex items-center gap-1.5 text-xs font-['Cinzel',Georgia,serif] font-semibold tracking-wider text-[var(--accent-text)]">
                  <Award className="w-3.5 h-3.5" />
                  <span>{data.siteCopy.homeCategoriesTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSoundTap();
                    onNavigate('competitions');
                  }}
                  className="text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{data.siteCopy.homeCategoriesLinkLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800/80">
                {data.categories.slice(0, 4).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSoundTap();
                      onNavigate('competitions', cat.id);
                    }}
                    className="w-full py-2.5 flex items-center justify-between gap-4 text-sm text-left hover:bg-stone-50/70 dark:hover:bg-stone-900/40 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">
                        {cat.name}
                      </p>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {cat.venue}
                      </span>
                    </div>
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums shrink-0">
                      {cat.scheduleWindow}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{data.banner.locationLabel}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
