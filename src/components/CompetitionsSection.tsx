import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, MapPin, Check, Sparkles, ChevronRight } from 'lucide-react';
import type { BracketMatch, CategoryCompetition, Team } from '../types';
import { BracketView, MatchBreakdownModal } from './BracketView';

interface CompetitionsSectionProps {
  categories: CategoryCompetition[];
  teams: Team[];
  compact: boolean;
  initialCategoryId?: string;
  eyebrow?: string;
  heading?: string;
  onSoundTap: () => void;
}

type SubView = 'all' | 'results' | 'bracket' | 'upcoming';

export const CompetitionsSection: React.FC<CompetitionsSectionProps> = ({
  categories,
  teams,
  compact,
  initialCategoryId,
  eyebrow = 'Match Results & Brackets',
  heading = 'Match Results & Knockout Brackets',
  onSoundTap,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId || categories[0]?.id || 'soccer-match'
  );
  const [subView, setSubView] = useState<SubView>('all');
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);

  useEffect(() => {
    if (initialCategoryId && categories.some((c) => c.id === initialCategoryId)) {
      setSelectedCategoryId(initialCategoryId);
    }
  }, [initialCategoryId, categories]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;
  }, [categories, selectedCategoryId]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const completedOrLiveMatches = useMemo(() => {
    if (!activeCategory) return [];
    return activeCategory.matches.filter(
      (m) => m.status === 'Completed' || m.status === 'Live'
    );
  }, [activeCategory]);

  const upcomingMatches = useMemo(() => {
    if (!activeCategory) return [];
    return activeCategory.matches.filter((m) => m.status === 'Upcoming');
  }, [activeCategory]);

  if (!activeCategory) {
    return null;
  }

  const getTeamDisplay = (teamId: string | null) => {
    if (!teamId) return 'TBD';
    return teamMap.get(teamId)?.name || teamId;
  };

  return (
    <section id="match-result" className={compact ? 'py-8' : 'py-12'}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90 dark:border-stone-800">
        <div>
          <p className="font-['Cinzel',Georgia,serif] text-xs tracking-[2px] uppercase text-[#9A7B2C] dark:text-[#a38735] mb-2">
            {eyebrow}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-950 dark:text-stone-50 text-balance">
            {heading}
          </h1>
        </div>

        {/* Sub-view Focus Selector */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-stone-200/55 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 self-start lg:self-auto overflow-x-auto max-w-full">
          {(
            [
              { id: 'all', label: 'Full View' },
              { id: 'results', label: 'Results' },
              { id: 'bracket', label: 'Bracket' },
              { id: 'upcoming', label: 'Upcoming' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onSoundTap();
                setSubView(tab.id);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subView === tab.id
                  ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Switcher Bar ("Soccer Match", "Survey Showdown", "Volley Match", etc.) */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const isSelected = cat.id === activeCategory.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onSoundTap();
                setSelectedCategoryId(cat.id);
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-white dark:bg-[#1C1917] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Active Category Editorial Header */}
      <div className="mt-8 rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>{activeCategory.format}</span>
            <span aria-hidden="true">·</span>
            <span>{activeCategory.venue}</span>
            <span aria-hidden="true">·</span>
            <span>{activeCategory.scheduleWindow}</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-stone-950 dark:text-stone-50 mt-2">
            {activeCategory.name}
          </h2>
          <p className="text-sm font-medium text-[var(--accent-text)] mt-1">
            {activeCategory.tagline}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-3 leading-relaxed max-w-3xl">
            {activeCategory.description}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-6 text-xs text-stone-600 dark:text-stone-400">
          <div>
            <span className="text-stone-400 dark:text-stone-500 mr-1.5">Completed Results:</span>
            <span className="font-mono tabular-nums font-semibold text-stone-900 dark:text-stone-100">
              {completedOrLiveMatches.length}
            </span>
          </div>
          <div>
            <span className="text-stone-400 dark:text-stone-500 mr-1.5">Upcoming Fixtures:</span>
            <span className="font-mono tabular-nums font-semibold text-stone-900 dark:text-stone-100">
              {upcomingMatches.length}
            </span>
          </div>
          <div>
            <span className="text-stone-400 dark:text-stone-500 mr-1.5">Total Bracket Fixtures:</span>
            <span className="font-mono tabular-nums font-semibold text-stone-900 dark:text-stone-100">
              {activeCategory.matches.length}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Completed & Live Match Results Block */}
      {(subView === 'all' || subView === 'results') && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-serif text-xl sm:text-2xl font-medium text-stone-950 dark:text-stone-50">
              Match Results — {activeCategory.name}
            </h3>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
              {completedOrLiveMatches.length} recorded
            </span>
          </div>

          {completedOrLiveMatches.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 p-8 text-center">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                No completed or live match results recorded for {activeCategory.name} yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedOrLiveMatches.map((match) => {
                const isWinnerA = Boolean(match.winnerId && match.winnerId === match.teamAId);
                const isWinnerB = Boolean(match.winnerId && match.winnerId === match.teamBId);

                return (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      onSoundTap();
                      setSelectedMatch(match);
                    }}
                    className="w-full text-left rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-colors p-5 flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
                  >
                    <div>
                      {/* Match Header */}
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 pb-3 border-b border-stone-100 dark:border-stone-800/80">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--accent-text)]">
                            {match.status === 'Live' ? 'LIVE' : 'FINAL'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{match.round}</span>
                          <span aria-hidden="true">·</span>
                          <span>Match {match.matchOrder}</span>
                        </div>
                        <span className="font-mono tabular-nums">
                          {match.date} · {match.time}
                        </span>
                      </div>

                      {/* Scoreboard Lines */}
                      <div className="mt-3 space-y-2">
                        <div
                          className={`px-3 py-2 rounded-lg flex items-center justify-between gap-3 ${
                            isWinnerA
                              ? 'bg-[var(--accent-soft)]'
                              : 'bg-stone-50/70 dark:bg-stone-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-sm truncate ${
                                isWinnerA
                                  ? 'font-semibold text-stone-950 dark:text-stone-50'
                                  : 'text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              {getTeamDisplay(match.teamAId)}
                            </span>
                            {isWinnerA && (
                              <Check
                                className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0"
                                aria-label="Winner"
                              />
                            )}
                          </div>
                          <span
                            className={`font-mono tabular-nums text-lg shrink-0 ${
                              isWinnerA
                                ? 'font-bold text-stone-950 dark:text-stone-50'
                                : 'font-medium text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {match.scoreA !== null ? match.scoreA : '—'}
                          </span>
                        </div>

                        <div
                          className={`px-3 py-2 rounded-lg flex items-center justify-between gap-3 ${
                            isWinnerB
                              ? 'bg-[var(--accent-soft)]'
                              : 'bg-stone-50/70 dark:bg-stone-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-sm truncate ${
                                isWinnerB
                                  ? 'font-semibold text-stone-950 dark:text-stone-50'
                                  : 'text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              {getTeamDisplay(match.teamBId)}
                            </span>
                            {isWinnerB && (
                              <Check
                                className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0"
                                aria-label="Winner"
                              />
                            )}
                          </div>
                          <span
                            className={`font-mono tabular-nums text-lg shrink-0 ${
                              isWinnerB
                                ? 'font-bold text-stone-950 dark:text-stone-50'
                                : 'font-medium text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {match.scoreB !== null ? match.scoreB : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Key Scorers / Note / Summary */}
                      {(match.note || match.mvp || (match.events && match.events.length > 0)) && (
                        <div className="mt-3 space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                          {match.mvp && (
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                              <span className="text-stone-500 dark:text-stone-400">MVP:</span>
                              <span className="font-medium text-stone-900 dark:text-stone-100">
                                {match.mvp}
                              </span>
                            </div>
                          )}
                          {match.events && match.events.length > 0 && (
                            <p className="text-stone-600 dark:text-stone-400 line-clamp-2">
                              {match.events
                                .slice(0, 3)
                                .map(
                                  (ev) =>
                                    `${ev.type} ${ev.player}${
                                      ev.minuteOrStage ? ` (${ev.minuteOrStage})` : ''
                                    }`
                                )
                                .join(' · ')}
                            </p>
                          )}
                          {!match.events?.length && match.note && <p>{match.note}</p>}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{match.venue}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--accent-text)]">
                        <span>Full Breakdown</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Tournament Bracket Block */}
      {(subView === 'all' || subView === 'bracket') && (
        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-5">
            <h3 className="font-serif text-xl sm:text-2xl font-medium text-stone-950 dark:text-stone-50">
              Tournament Bracket — {activeCategory.name}
            </h3>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Single Elimination Progression
            </span>
          </div>

          <BracketView
            matches={activeCategory.matches}
            teams={teams}
            onSoundTap={onSoundTap}
            onSelectMatch={(match) => setSelectedMatch(match)}
          />
        </div>
      )}

      {/* 3. Upcoming Fixtures Block */}
      {(subView === 'all' || subView === 'upcoming') && (
        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-serif text-xl sm:text-2xl font-medium text-stone-950 dark:text-stone-50">
              Upcoming Fixtures — {activeCategory.name}
            </h3>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
              {upcomingMatches.length} scheduled
            </span>
          </div>

          {upcomingMatches.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 p-8 text-center">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                All fixtures in {activeCategory.name} have concluded. Check the results and bracket above for final scores.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 divide-y divide-stone-200/80 dark:divide-stone-800">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-stone-900/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-medium text-[var(--accent-text)]">{match.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>{match.round}</span>
                      {match.note && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{match.note}</span>
                        </>
                      )}
                    </div>
                    <p className="text-base sm:text-lg font-medium text-stone-950 dark:text-stone-50">
                      <span>{getTeamDisplay(match.teamAId)}</span>
                      <span className="mx-2.5 text-xs uppercase tracking-widest text-stone-400 font-normal">
                        vs
                      </span>
                      <span>{getTeamDisplay(match.teamBId)}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-400 shrink-0">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      {match.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {match.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      {match.venue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unified Match Breakdown Modal for both Result cards & Bracket nodes */}
      {selectedMatch && (
        <MatchBreakdownModal
          match={selectedMatch}
          teams={teams}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </section>
  );
};
