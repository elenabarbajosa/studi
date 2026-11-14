import {
  BookOpen,
  Calendar,
  CalendarRange,
  ChartColumn,
  CircleCheck,
  Coffee,
  Ellipsis,
  House,
  LayoutGrid,
  Play,
  Settings,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  comingSoon?: boolean;
  /** Extra search terms for the command menu. */
  keywords?: string[];
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export const dashboardNav: NavItem = {
  title: "Dashboard",
  href: "/dashboard",
  icon: LayoutGrid,
  description: "Your study overview",
  keywords: ["home", "today", "overview"],
};

export const tasksNav: NavItem = {
  title: "Tasks",
  href: "/tasks",
  icon: CircleCheck,
  description: "Personal task list",
  keywords: ["todo", "to-do", "assignments"],
};

export const calendarNav: NavItem = {
  title: "Calendar",
  href: "/calendar",
  icon: Calendar,
  description: "Classes, exams and sessions",
  keywords: ["schedule", "events", "exams", "deadlines"],
};

export const plannerNav: NavItem = {
  title: "Study Planner",
  href: "/planner",
  icon: CalendarRange,
  description: "Coming soon",
  comingSoon: true,
  keywords: ["plan"],
};

export const focusNav: NavItem = {
  title: "Focus",
  href: "/focus",
  icon: Timer,
  description: "Pomodoro timer",
  keywords: ["pomodoro", "timer", "session", "start focus"],
};

export const subjectsNav: NavItem = {
  title: "Subjects",
  href: "/subjects",
  icon: BookOpen,
  description: "Courses, topics and exams",
  keywords: ["courses", "topics", "materials"],
};

export const studyTogetherNav: NavItem = {
  title: "Study Together",
  href: "/study-together",
  icon: Coffee,
  description: "Shared study rooms",
  keywords: ["rooms", "group", "live"],
};

export const friendsNav: NavItem = {
  title: "Friends",
  href: "/friends",
  icon: Users,
  description: "Study companions",
  keywords: ["people", "requests"],
};

export const statisticsNav: NavItem = {
  title: "Statistics",
  href: "/statistics",
  icon: ChartColumn,
  description: "Focus time and trends",
  keywords: ["stats", "insights", "hours"],
};

export const progressNav: NavItem = {
  title: "Progress",
  href: "/progress",
  icon: Trophy,
  description: "Streaks and achievements",
  keywords: ["streak", "badges", "achievements", "challenges", "leaderboard"],
};

export const settingsNav: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Profile and preferences",
  keywords: ["preferences", "appearance", "theme", "accent", "privacy", "account"],
};

export const navGroups: NavGroup[] = [
  { label: null, items: [dashboardNav, tasksNav, calendarNav, plannerNav] },
  { label: "Study", items: [focusNav, subjectsNav] },
  { label: "Together", items: [studyTogetherNav, friendsNav] },
  { label: "Insights", items: [statisticsNav, progressNav] },
];

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsNav,
];

export type MobileTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
};

export const MORE_HREF = "/more";

export const mobileTabs: MobileTab[] = [
  { title: "Today", href: dashboardNav.href, icon: House },
  { title: "Calendar", href: calendarNav.href, icon: Calendar },
  { title: "Focus", href: focusNav.href, icon: Play, primary: true },
  { title: "Tasks", href: tasksNav.href, icon: CircleCheck },
  { title: "More", href: MORE_HREF, icon: Ellipsis },
];

export const moreNav: NavItem[] = [
  studyTogetherNav,
  subjectsNav,
  plannerNav,
  progressNav,
  statisticsNav,
  friendsNav,
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
