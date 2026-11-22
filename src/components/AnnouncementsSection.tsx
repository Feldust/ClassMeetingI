import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
} from 'lucide-react';
import type { Announcement, RundownStatus, SiteCopyConfig } from '../types';

interface AnnouncementsSectionProps {
  announcements: Announcement[];
  compact: boolean;
  siteCopy?: Partial<SiteCopyConfig>;
  onSoundTap: () => void;
}

function resolveDayLabel(item: Announcement): string {
  if (item.dayLabel && item.dayLabel.trim()) return item.dayLabel.trim();
  const part = item.date.split('·')[0]?.trim();
  return part || 'Schedule';
}

function resolveTimeLabel(item: Announcement): string {
  if (item.timeRange && item.timeRange.trim()) return item.timeRange.trim();
  const parts = item.date.split('·');
  if (parts.length > 1 && parts[1].trim()) return parts[1].trim();
  return item.date;
}

function statusClasses(status?: RundownStatus): string {
  if (status === 'Ongoing') {
    return 'bg-amber-500/15 text-[#9A5B00] dark:text-amber-300 border-amber-500/30';
  }
  if (status === 'Completed') {
    return 'bg-stone-200/70 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 border-stone-300/70 dark:border-stone-700';
  }
  return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25';
}

export const AnnouncementsSection: React.FC<AnnouncementsSectionProps> = ({
  announcements,
  compact,
  siteCopy,
  onSoundTap,
}) => {
  const eyebrow = siteCopy?.announcementsEyebrow || 'Event Rundown & Schedule';
  const heading = siteCopy?.announcementsHeading || 'Daily Rundown & Activity Timeline';
  const searchPlaceholder =
    siteCopy?.rundownSearchPlaceholder || 'Search schedule, venues, or PIC...';
  const allDaysLabel = siteCopy?.rundownAllDaysLabel || 'All Days';
  const allCatsLabel = siteCopy?.rundownAllCategoriesLabel || 'All';
  const featuredBadge = siteCopy?.rundownFeaturedBadge || 'Featured Schedule Slot';
  const showDetailsLabel = siteCopy?.rundownShowDetailsLabel || 'Session Details';
  const hideDetailsLabel = siteCopy?.rundownHideDetailsLabel || 'Hide Details';
  const coordinatorLabel = siteCopy?.rundownCoordinatorLabel || 'Coordinator / PIC:';
  const emptyTitle = siteCopy?.rundownEmptyTitle || 'No rundown slots match this filter.';
  const emptySubtitle =
    siteCopy?.rundownEmptySubtitle || 'Try clearing your search query or switching back to All Days.';
  const resetFilterLabel = siteCopy?.rundownResetFilterLabel || 'Show Full Schedule';

  const [selectedDay, setSelectedDay] = useState<string>('ALL_DAYS');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL_CATEGORIES');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dayTabs = useMemo(() => {
    const unique = Array.from(new Set(announcements.map(resolveDayLabel)));
    return [
      { id: 'ALL_DAYS', label: allDaysLabel },
      ...unique.map((d) => ({ id: d, label: d })),
    ];
  }, [announcements, allDaysLabel]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(announcements.map((a) => a.category)));
    return [
      { id: 'ALL_CATEGORIES', label: allCatsLabel },
      ...unique.map((c) => ({ id: c, label: c })),
    ];
  }, [announcements, allCatsLabel]);

  const featuredSession = useMemo(() => {
    return announcements.find((a) => a.isFeatured) || announcements[0] || null;
  }, [announcements]);

  const filteredSessions = useMemo(() => {
    return announcements.filter((a) => {
      const itemDay = resolveDayLabel(a);
      const matchesDay = selectedDay === 'ALL_DAYS' || itemDay === selectedDay;
      const matchesCat = selectedCategory === 'ALL_CATEGORIES' || a.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.venue.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        itemDay.toLowerCase().includes(q);
      return matchesDay && matchesCat && matchesQuery;
    });
  }, [announcements, selectedDay, selectedCategory, searchQuery]);

  const groupedByDay = useMemo(() => {
    const groups: { dayLabel: string; items: Announcement[] }[] = [];
    const indexByDay = new Map<string, number>();

    for (const item of filteredSessions) {
      const label = resolveDayLabel(item);
      const existingIdx = indexByDay.get(label);
      if (existingIdx === undefined) {
        indexByDay.set(label, groups.length);
        groups.push({ dayLabel: label, items: [item] });
      } else {
        groups[existingIdx].items.push(item);
      }
    }
    return groups;
  }, [filteredSessions]);

  const isUnfiltered =
    selectedDay === 'ALL_DAYS' && selectedCategory === 'ALL_CATEGORIES' && !searchQuery.trim();

  return (
    <section id="rundown" className={compact ? 'py-8' : 'py-12'}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90 dark:border-stone-800">
        <div>
          <p className="font-['Cinzel',Georgia,serif] text-xs tracking-[2px] uppercase text-[#9A7B2C] dark:text-[#a38735] mb-2">
            {eyebrow}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-950 dark:text-stone-50 text-balance">
            {heading}
          </h1>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
          />
        </div>
      </div>

      {/* Day & Category Filter Bars */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Day Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-stone-200/55 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800">
            {dayTabs.map((day) => {
              const active = selectedDay === day.id;
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    onSoundTap();
                    setSelectedDay(day.id);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-stone-200/40 dark:bg-stone-900/70 border border-stone-200/60 dark:border-stone-800">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onSoundTap();
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Featured Schedule Slot (shown when unfiltered) */}
      {featuredSession && isUnfiltered && (
        <article className="mt-7 rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <span className="font-['Cinzel',Georgia,serif] font-semibold tracking-wider uppercase text-[var(--accent-text)]">
                {featuredBadge}
              </span>
              <span aria-hidden="true">·</span>
              <span>{resolveDayLabel(featuredSession)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-stone-800 dark:text-stone-200">
                {resolveTimeLabel(featuredSession)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{featuredSession.venue}</span>
            </div>

            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium rounded-md border ${statusClasses(
                featuredSession.scheduleStatus
              )}`}
            >
              {featuredSession.scheduleStatus || 'Upcoming'}
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-stone-950 dark:text-stone-50 mt-3 max-w-3xl text-balance">
            {featuredSession.title}
          </h2>

          <p className="mt-3 text-base text-stone-700 dark:text-stone-300 leading-relaxed max-w-3xl">
            {featuredSession.body}
          </p>

          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {coordinatorLabel} {featuredSession.author}
              </span>
            </span>
            <span>
              {featuredSession.category} · {featuredSession.priority}
            </span>
          </div>
        </article>
      )}

      {/* Chronological Grouped-By-Day Timeline */}
      {groupedByDay.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 p-10 text-center">
          <p className="font-serif text-lg text-stone-800 dark:text-stone-200">{emptyTitle}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-4">{emptySubtitle}</p>
          <button
            type="button"
            onClick={() => {
              onSoundTap();
              setSelectedDay('ALL_DAYS');
              setSelectedCategory('ALL_CATEGORIES');
              setSearchQuery('');
            }}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            {resetFilterLabel}
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groupedByDay.map((group) => (
            <div key={group.dayLabel}>
              {/* Day Group Header */}
              <div className="flex items-center justify-between gap-4 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
                  <h2 className="font-['Cinzel',Georgia,serif] text-sm sm:text-base font-semibold tracking-wider uppercase text-stone-900 dark:text-stone-100">
                    {group.dayLabel}
                  </h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
                  {group.items.length} {group.items.length === 1 ? 'session' : 'sessions'}
                </span>
              </div>

              {/* Timeline Container */}
              <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-stone-200/90 dark:border-stone-800 divide-y divide-stone-200/80 dark:divide-stone-800">
                {group.items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const timeText = resolveTimeLabel(item);
                  const status = item.scheduleStatus || 'Upcoming';

                  return (
                    <article
                      key={item.id}
                      className={compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                        {/* Left Time & Status Column */}
                        <div className="md:w-44 shrink-0 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-2">
                          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100">
                            <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                            <span>{timeText}</span>
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border ${statusClasses(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </div>

                        {/* Middle Details Column */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className="font-medium text-stone-700 dark:text-stone-300">
                              {item.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{item.priority}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{item.venue}</span>
                            </span>
                          </div>

                          <h3 className="font-serif text-lg sm:text-xl font-medium text-stone-900 dark:text-stone-100 mt-1.5">
                            {item.title}
                          </h3>

                          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                            {isExpanded ? item.body : item.summary}
                          </p>

                          {isExpanded && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 mt-3 inline-flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>
                                {coordinatorLabel} {item.author}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Right Expand Action */}
                        <button
                          type="button"
                          onClick={() => {
                            onSoundTap();
                            setExpandedId(isExpanded ? null : item.id);
                          }}
                          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-stone-50 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>{isExpanded ? hideDetailsLabel : showDetailsLabel}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
