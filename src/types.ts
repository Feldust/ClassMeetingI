export type AccentTone = 'forest' | 'amber' | 'slate';
export type MotionPreference = 'smooth' | 'reduced';

export interface UISettings {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  soundVolume: number;
  accentTone: AccentTone;
  motionPreference: MotionPreference;
  compactDensity: boolean;
}

export interface Team {
  id: string;
  name: string;
  shortCode: string;
  cohort: string;
  captain: string;
  motto: string;
}

export type AnnouncementPriority =
  | 'Ceremony'
  | 'Match'
  | 'Briefing'
  | 'Finals'
  | 'Important'
  | 'Schedule Update'
  | 'Results'
  | 'Bulletin';

export type RundownStatus = 'Completed' | 'Ongoing' | 'Upcoming';

export interface Announcement {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  date: string;
  dayLabel?: string;
  timeRange?: string;
  scheduleStatus?: RundownStatus;
  venue: string;
  author: string;
  isFeatured: boolean;
  priority: AnnouncementPriority;
}

export type BracketRound = 'Qualifying Round' | 'Quarterfinals' | 'Semifinals' | 'Final';
export type MatchStatus = 'Completed' | 'Live' | 'Upcoming';

export interface MatchEvent {
  id: string;
  type: string;
  player: string;
  teamSide: 'A' | 'B';
  minuteOrStage: string;
  detail?: string;
}

export interface BracketMatch {
  id: string;
  round: BracketRound;
  matchOrder: number; // 1..4 for QF, 1..2 for SF, 1 for Final
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: MatchStatus;
  date: string;
  time: string;
  venue: string;
  note?: string;
  referee?: string;
  mvp?: string;
  summary?: string;
  events?: MatchEvent[];
}

export interface CategoryCompetition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  venue: string;
  format: string;
  scheduleWindow: string;
  imageUrl: string;
  matches: BracketMatch[];
}

export interface LeaderboardEntry {
  id: string;
  teamId: string;
  participantName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gold: number;
  silver: number;
  bronze: number;
  metricDetail: string;
  points: number;
}

export interface LeaderboardGame {
  id: string;
  name: string;
  gameType: 'medal-tally' | 'match-table' | 'points-ranking';
  subtitle: string;
  metricLabel: string;
  detailColumnLabel: string;
  entries: LeaderboardEntry[];
}

export interface SiteBannerInfo {
  heroTitle: string;
  editionLabel: string;
  headline: string;
  subheadline: string;
  datesLabel: string;
  locationLabel: string;
  heroImageUrl: string;
}

export interface SiteCopyConfig {
  navHomeLabel: string;
  navAnnouncementsLabel: string;
  navCompetitionsLabel: string;
  navLeaderboardLabel: string;
  navSettingsLabel: string;
  heroPrimaryCtaLabel: string;
  heroSecondaryCtaLabel: string;
  homeLeadNoticeTitle: string;
  homeLeadNoticeLinkLabel: string;
  homeSessionsCountLabel: string;
  homeVersusLabel: string;
  homeUpcomingTitle: string;
  homeUpcomingLinkLabel: string;
  homeStandingsTitle: string;
  homeStandingsLinkLabel: string;
  homeCategoriesTitle: string;
  homeCategoriesLinkLabel: string;
  announcementsEyebrow: string;
  announcementsHeading: string;
  rundownSearchPlaceholder: string;
  rundownAllDaysLabel: string;
  rundownAllCategoriesLabel: string;
  rundownFeaturedBadge: string;
  rundownShowDetailsLabel: string;
  rundownHideDetailsLabel: string;
  rundownCoordinatorLabel: string;
  rundownEmptyTitle: string;
  rundownEmptySubtitle: string;
  rundownResetFilterLabel: string;
  competitionsEyebrow: string;
  competitionsHeading: string;
  matchResultTabAllLabel: string;
  matchResultTabResultsLabel: string;
  matchResultTabBracketLabel: string;
  matchResultTabUpcomingLabel: string;
  matchResultCompletedStatLabel: string;
  matchResultUpcomingStatLabel: string;
  matchResultTotalStatLabel: string;
  matchResultResultsTitle: string;
  matchResultBracketTitle: string;
  matchResultBracketSubtitle: string;
  matchResultUpcomingTitle: string;
  matchResultBreakdownButtonLabel: string;
  bracketColQualifying: string;
  bracketColQuarterfinals: string;
  bracketColSemifinals: string;
  bracketColFinal: string;
  bracketTitleMatchTag: string;
  bracketChampionLabel: string;
  bracketHelperNote: string;
  leaderboardEyebrow: string;
  leaderboardHeading: string;
  leaderboardSearchPlaceholder: string;
  leaderboardSortLabel: string;
  leaderboardSortPointsLabel: string;
  leaderboardSortWinsLabel: string;
  leaderboardSortPlayedLabel: string;
  leaderboardColRank: string;
  leaderboardColContender: string;
  leaderboardColPlayed: string;
  leaderboardColGold: string;
  leaderboardColSilver: string;
  leaderboardColBronze: string;
  leaderboardColWon: string;
  leaderboardColDrawn: string;
  leaderboardColLost: string;
  leaderboardEmptyText: string;
  footerBrandTitle: string;
  footerTagline: string;
  footerCreditPrefix: string;
  footerCreditBrand: string;
  footerCreditSuffix: string;
}

export type AdminPanelTabId = 'site' | 'announcements' | 'brackets' | 'leaderboards' | 'teams';

export interface AdminPanelConfig {
  panelTitle: string;
  panelSubtitle: string;
  lockPromptTitle: string;
  lockPromptMessage: string;
  allowedTabs: AdminPanelTabId[];
  allowResetDefaults: boolean;
  allowDeleteItems: boolean;
}

export interface AppDataState {
  banner: SiteBannerInfo;
  siteCopy: SiteCopyConfig;
  adminPanelConfig: AdminPanelConfig;
  teams: Team[];
  announcements: Announcement[];
  categories: CategoryCompetition[];
  leaderboards: LeaderboardGame[];
  lastUpdated: string;
}

export type AuthRole = 'admin' | 'master';
