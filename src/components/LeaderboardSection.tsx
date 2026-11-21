import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import type { LeaderboardGame } from '../types';

interface LeaderboardSectionProps {
  leaderboards: LeaderboardGame[];
  compact: boolean;
  eyebrow?: string;
  heading?: string;
  onSoundTap: () => void;
}

type SortKey = 'points' | 'won' | 'played';

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  leaderboards,
  compact,
  eyebrow = 'Leaderboard Mode',
  heading = 'Standings Across Game Modes',
  onSoundTap,
}) => {
  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    leaderboards[0]?.id || 'lb-overall'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('points');

  const activeBoard = useMemo(() => {
    return leaderboards.find((b) => b.id === selectedBoardId) || leaderboards[0] || null;
  }, [leaderboards, selectedBoardId]);

  const sortedEntries = useMemo(() => {
    if (!activeBoard) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = activeBoard.entries.filter(
      (e) =>
        !q ||
        e.participantName.toLowerCase().includes(q) ||
        e.metricDetail.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === 'won') return b.won - a.won || b.points - a.points;
      if (sortKey === 'played') return b.played - a.played || b.points - a.points;
      return b.points - a.points || b.won - a.won;
    });
  }, [activeBoard, searchQuery, sortKey]);

  if (!activeBoard) return null;

  return (
    <section id="leaderboard" className={compact ? 'py-8' : 'py-12'}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90 dark:border-stone-800">
        <div>
          <p className="font-['Cinzel',Georgia,serif] text-xs tracking-[2px] uppercase text-[#9A7B2C] dark:text-[#a38735] mb-2">
            {eyebrow}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-950 dark:text-stone-50 text-balance">
            {heading}
          </h1>
        </div>

        <div className="relative w-full lg:w-64 shrink-0">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter class or player..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
          />
        </div>
      </div>

      {/* Game Type Leaderboard Selector */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {leaderboards.map((board) => {
            const active = board.id === activeBoard.id;
            return (
              <button
                key={board.id}
                type="button"
                onClick={() => {
                  onSoundTap();
                  setSelectedBoardId(board.id);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                    : 'bg-white dark:bg-[#1C1917] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600'
                }`}
              >
                {board.name}
              </button>
            );
          })}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort by:</span>
          {(['points', 'won', 'played'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSoundTap();
                setSortKey(key);
              }}
              className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                sortKey === key
                  ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-950 dark:text-stone-100'
                  : 'hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {key === 'won' ? 'Wins' : key}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
        {activeBoard.subtitle}
      </p>

      {/* Standings Table */}
      <div className="mt-5 rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 bg-stone-50/70 dark:bg-stone-900/50">
                <th className="py-3.5 pl-5 pr-3 font-medium w-16">Rank</th>
                <th className="py-3.5 px-4 font-medium">Class / Contender</th>
                <th className="py-3.5 px-3 font-medium text-right">Played</th>
                {activeBoard.gameType === 'medal-tally' ? (
                  <>
                    <th className="py-3.5 px-3 font-medium text-right">Gold</th>
                    <th className="py-3.5 px-3 font-medium text-right">Silver</th>
                    <th className="py-3.5 px-3 font-medium text-right">Bronze</th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-3 font-medium text-right">Won</th>
                    <th className="py-3.5 px-3 font-medium text-right">Drawn</th>
                    <th className="py-3.5 px-3 font-medium text-right">Lost</th>
                  </>
                )}
                <th className="py-3.5 px-4 font-medium hidden sm:table-cell">
                  {activeBoard.detailColumnLabel}
                </th>
                <th className="py-3.5 pl-3 pr-5 font-medium text-right">
                  {activeBoard.metricLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 text-sm">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 px-6 text-center text-stone-500 dark:text-stone-400"
                  >
                    No contenders match your search filter.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((row, idx) => {
                  const isTopThree = idx < 3;
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-900/50 ${
                        idx === 0 ? 'bg-[var(--accent-soft)]' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-3 font-mono tabular-nums text-xs text-stone-500 dark:text-stone-400">
                        <span
                          className={
                            isTopThree
                              ? 'font-semibold text-stone-950 dark:text-stone-100'
                              : ''
                          }
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {row.participantName}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                        {row.played}
                      </td>

                      {activeBoard.gameType === 'medal-tally' ? (
                        <>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-800 dark:text-stone-200 font-medium">
                            {row.gold}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                            {row.silver}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                            {row.bronze}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-800 dark:text-stone-200 font-medium">
                            {row.won}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                            {row.drawn}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-stone-600 dark:text-stone-400">
                            {row.lost}
                          </td>
                        </>
                      )}

                      <td className="py-3.5 px-4 text-xs text-stone-500 dark:text-stone-400 hidden sm:table-cell">
                        {row.metricDetail}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right font-mono tabular-nums font-semibold text-stone-950 dark:text-stone-50">
                        {row.points}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
