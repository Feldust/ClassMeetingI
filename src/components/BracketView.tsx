import React, { useState } from 'react';
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  X,
  Check,
  Sparkles,
  UserCheck,
  Activity,
} from 'lucide-react';
import type { BracketMatch, Team } from '../types';

interface BracketViewProps {
  matches: BracketMatch[];
  teams: Team[];
  onSoundTap: () => void;
  onSelectMatch?: (match: BracketMatch) => void;
}

export const BracketView: React.FC<BracketViewProps> = ({
  matches,
  teams,
  onSoundTap,
  onSelectMatch,
}) => {
  const [internalSelectedMatch, setInternalSelectedMatch] = useState<BracketMatch | null>(null);

  const handleOpenMatch = (match: BracketMatch) => {
    onSoundTap();
    if (onSelectMatch) {
      onSelectMatch(match);
    } else {
      setInternalSelectedMatch(match);
    }
  };

  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

  const qualifying = matches
    .filter((m) => m.round === 'Qualifying Round')
    .sort((a, b) => a.matchOrder - b.matchOrder);
  const quarterfinals = matches
    .filter((m) => m.round === 'Quarterfinals')
    .sort((a, b) => a.matchOrder - b.matchOrder);
  const semifinals = matches
    .filter((m) => m.round === 'Semifinals')
    .sort((a, b) => a.matchOrder - b.matchOrder);
  const finals = matches
    .filter((m) => m.round === 'Final')
    .sort((a, b) => a.matchOrder - b.matchOrder);

  const getTeamLabel = (teamId: string | null) => {
    if (!teamId) return { name: 'To Be Determined', short: 'TBD', captain: '—', motto: '' };
    const found = teamMap.get(teamId);
    if (!found) {
      return { name: teamId, short: teamId.slice(0, 5).toUpperCase(), captain: '—', motto: '' };
    }
    return {
      name: found.name,
      short: found.shortCode,
      captain: found.captain,
      motto: found.motto,
    };
  };

  const finalMatch = finals[0] || null;
  const championTeam =
    finalMatch && finalMatch.winnerId ? teamMap.get(finalMatch.winnerId) || null : null;

  const renderMatchNode = (match: BracketMatch, roundLabel: string) => {
    const teamA = getTeamLabel(match.teamAId);
    const teamB = getTeamLabel(match.teamBId);
    const isWinnerA = Boolean(match.winnerId && match.winnerId === match.teamAId);
    const isWinnerB = Boolean(match.winnerId && match.winnerId === match.teamBId);
    const eventCount = match.events?.length || 0;

    return (
      <button
        key={match.id}
        type="button"
        onClick={() => handleOpenMatch(match)}
        className="w-full text-left rounded-xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-colors duration-150 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
      >
        {/* Header metadata */}
        <div className="px-3.5 py-2 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5 truncate">
            <span>{roundLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{match.time}</span>
          </div>
          <span
            className={`font-medium whitespace-nowrap shrink-0 ${
              match.status === 'Live'
                ? 'text-amber-700 dark:text-amber-400'
                : match.status === 'Completed'
                ? 'text-stone-700 dark:text-stone-300'
                : 'text-stone-400 dark:text-stone-500'
            }`}
          >
            {match.status}
          </span>
        </div>

        {/* Team Rows */}
        <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
          <div
            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
              isWinnerA ? 'bg-[var(--accent-soft)]' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] text-stone-400 dark:text-stone-500 w-10 shrink-0">
                {teamA.short}
              </span>
              <span
                className={`text-sm truncate ${
                  !match.teamAId
                    ? 'italic text-stone-400 dark:text-stone-500'
                    : isWinnerA
                    ? 'font-semibold text-stone-950 dark:text-stone-50'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {teamA.name}
              </span>
              {isWinnerA && (
                <Check
                  className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0"
                  aria-label="Winner"
                />
              )}
            </div>
            <span
              className={`font-mono tabular-nums text-sm shrink-0 ${
                isWinnerA
                  ? 'font-semibold text-stone-950 dark:text-stone-50'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {match.scoreA !== null ? match.scoreA : '—'}
            </span>
          </div>

          <div
            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
              isWinnerB ? 'bg-[var(--accent-soft)]' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] text-stone-400 dark:text-stone-500 w-10 shrink-0">
                {teamB.short}
              </span>
              <span
                className={`text-sm truncate ${
                  !match.teamBId
                    ? 'italic text-stone-400 dark:text-stone-500'
                    : isWinnerB
                    ? 'font-semibold text-stone-950 dark:text-stone-50'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {teamB.name}
              </span>
              {isWinnerB && (
                <Check
                  className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0"
                  aria-label="Winner"
                />
              )}
            </div>
            <span
              className={`font-mono tabular-nums text-sm shrink-0 ${
                isWinnerB
                  ? 'font-semibold text-stone-950 dark:text-stone-50'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {match.scoreB !== null ? match.scoreB : '—'}
            </span>
          </div>
        </div>

        {/* Footer Cue when highlights / scorers are recorded */}
        {(eventCount > 0 || match.mvp) && (
          <div className="px-3.5 py-1.5 bg-stone-50/80 dark:bg-stone-900/50 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span className="truncate">
              {eventCount > 0 ? `${eventCount} match highlight${eventCount > 1 ? 's' : ''}` : 'Details ready'}
            </span>
            <span className="text-[var(--accent-text)] font-medium shrink-0 ml-2">
              View stats →
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto pb-3">
        <div
          className={`grid gap-8 items-stretch ${
            qualifying.length > 0 ? 'min-w-[1080px] grid-cols-4' : 'min-w-[820px] grid-cols-3'
          }`}
        >
          {/* Optional Column 0: Qualifying Round */}
          {qualifying.length > 0 && (
            <div className="flex flex-col justify-between gap-4">
              <div className="pb-2 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <h4 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">
                  Qualifying Round
                </h4>
                <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                  {qualifying.length} {qualifying.length === 1 ? 'Match' : 'Matches'}
                </span>
              </div>
              <div className="flex flex-col justify-around flex-1 gap-4">
                {qualifying.map((m, idx) => renderMatchNode(m, `Qual ${idx + 1}`))}
              </div>
            </div>
          )}

          {/* Column 1: Quarterfinals */}
          <div className="flex flex-col justify-between gap-4">
            <div className="pb-2 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <h4 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">
                Quarterfinals
              </h4>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                {quarterfinals.length} Matches
              </span>
            </div>
            <div className="flex flex-col justify-around flex-1 gap-4">
              {quarterfinals.map((m, idx) => renderMatchNode(m, `QF ${idx + 1}`))}
            </div>
          </div>

          {/* Column 2: Semifinals */}
          <div className="flex flex-col justify-between gap-4">
            <div className="pb-2 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <h4 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">
                Semifinals
              </h4>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                {semifinals.length} Matches
              </span>
            </div>
            <div className="flex flex-col justify-around flex-1 gap-8 py-6">
              {semifinals.map((m, idx) => renderMatchNode(m, `SF ${idx + 1}`))}
            </div>
          </div>

          {/* Column 3: Grand Final & Champion Callout */}
          <div className="flex flex-col justify-between gap-4">
            <div className="pb-2 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <h4 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">
                Championship Final
              </h4>
              <span className="text-xs text-stone-500 dark:text-stone-400">Title Match</span>
            </div>
            <div className="flex flex-col justify-center flex-1 gap-6">
              {finals.map((m) => renderMatchNode(m, 'Grand Final'))}

              <div className="rounded-xl bg-[#F5F1E8] dark:bg-stone-900/80 border border-stone-200/90 dark:border-stone-800 p-4">
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Tournament Champion</span>
                </div>
                {championTeam ? (
                  <div>
                    <p className="font-serif text-lg font-semibold text-stone-950 dark:text-stone-50">
                      {championTeam.name}
                    </p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                      Captained by {championTeam.captain}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    Awaiting Championship Final result ({finalMatch?.date || 'Scheduled'})
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
        Click any bracket fixture above to inspect scorers (&ldquo;Goal by&rdquo;), MVPs, referees, venues, and team captains.
      </p>

      {/* Rich Match Detail Modal (when BracketView manages its own modal state) */}
      {!onSelectMatch && internalSelectedMatch && (
        <MatchBreakdownModal
          match={internalSelectedMatch}
          teams={teams}
          onClose={() => setInternalSelectedMatch(null)}
        />
      )}
    </div>
  );
};

interface MatchBreakdownModalProps {
  match: BracketMatch;
  teams: Team[];
  onClose: () => void;
}

export const MatchBreakdownModal: React.FC<MatchBreakdownModalProps> = ({
  match,
  teams,
  onClose,
}) => {
  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const getTeamLabel = (teamId: string | null) => {
    if (!teamId) return { name: 'To Be Determined', short: 'TBD', captain: '—', motto: '' };
    const found = teamMap.get(teamId);
    if (!found) {
      return { name: teamId, short: teamId.slice(0, 5).toUpperCase(), captain: '—', motto: '' };
    }
    return {
      name: found.name,
      short: found.shortCode,
      captain: found.captain,
      motto: found.motto,
    };
  };

  return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-[#FBF9F5] dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 shadow-2xl text-stone-900 dark:text-stone-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <span>{match.round}</span>
                  <span aria-hidden="true">·</span>
                  <span>Match {match.matchOrder}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[var(--accent-text)]">
                    {match.status}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-semibold mt-1">Match Breakdown</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close fixture modal"
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Team Cards */}
              <div className="space-y-2.5">
                {(['A', 'B'] as const).map((side) => {
                  const tId = side === 'A' ? match.teamAId : match.teamBId;
                  const score = side === 'A' ? match.scoreA : match.scoreB;
                  const info = getTeamLabel(tId);
                  const won = Boolean(match.winnerId && match.winnerId === tId);

                  return (
                    <div
                      key={side}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                        won
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                          : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-stone-400 dark:text-stone-500">
                            {info.short}
                          </span>
                          <p className="font-medium text-sm text-stone-950 dark:text-stone-100 truncate">
                            {info.name}
                          </p>
                          {won && (
                            <span className="text-[11px] font-semibold text-[var(--accent-text)]">
                              Winner
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          Captain: {info.captain}
                          {info.motto ? ` · "${info.motto}"` : ''}
                        </p>
                      </div>
                      <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900 dark:text-stone-100 shrink-0">
                        {score !== null ? score : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Match Summary & MVP */}
              {(match.summary || match.mvp) && (
                <div className="rounded-xl bg-white dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 p-4 space-y-2.5">
                  {match.mvp && (
                    <div className="flex items-center gap-2 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                      <span className="text-stone-500 dark:text-stone-400">Match MVP:</span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {match.mvp}
                      </span>
                    </div>
                  )}
                  {match.summary && (
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                      {match.summary}
                    </p>
                  )}
                </div>
              )}

              {/* Match Highlights / Scorers Timeline ("Goal by", etc.) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <Activity className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Match Events & Highlights</span>
                </div>

                {match.events && match.events.length > 0 ? (
                  <div className="rounded-xl bg-white dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
                    {match.events.map((ev) => {
                      const sideTeam =
                        ev.teamSide === 'A'
                          ? getTeamLabel(match.teamAId)
                          : getTeamLabel(match.teamBId);

                      return (
                        <div
                          key={ev.id}
                          className="px-4 py-3 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                                {sideTeam.short}
                              </span>
                              <span className="font-semibold text-[var(--accent-text)]">
                                {ev.type}
                              </span>
                              <span className="font-medium text-stone-950 dark:text-stone-100">
                                {ev.player}
                              </span>
                            </div>
                            {ev.detail && (
                              <p className="text-stone-500 dark:text-stone-400 leading-relaxed">
                                {ev.detail}
                              </p>
                            )}
                          </div>
                          {ev.minuteOrStage && (
                            <span className="font-mono tabular-nums text-[11px] text-stone-500 dark:text-stone-400 shrink-0 pt-0.5">
                              {ev.minuteOrStage}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                    No play-by-play events or goal logs recorded for this fixture yet.
                  </p>
                )}
              </div>

              {/* Venue, Schedule & Referee Metadata */}
              <div className="pt-3 border-t border-stone-200/80 dark:border-stone-800 space-y-2 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex flex-wrap items-center gap-3">
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
                {match.referee && (
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                    <span>Official: {match.referee}</span>
                  </div>
                )}
                {match.note && (
                  <p className="text-stone-700 dark:text-stone-300 pt-1">
                    Note: {match.note}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
  );
};
