import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  CheckSquare,
  Focus,
  Handshake,
  LayoutDashboard,
  Settings,
  Trophy,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  comingSoon?: boolean;
};

export const mainNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your study overview",
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Academic calendar",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    description: "Personal task list",
  },
  {
    title: "Subjects",
    href: "/subjects",
    icon: BookOpen,
    description: "Courses and notes",
  },
  {
    title: "Study Planner",
    href: "/planner",
    icon: ClipboardList,
    description: "Plan your sessions",
    comingSoon: true,
  },
  {
    title: "Focus",
    href: "/focus",
    icon: Focus,
    description: "Pomodoro timer",
  },
  {
    title: "Friends",
    href: "/friends",
    icon: Users,
    description: "Study companions",
  },
  {
    title: "Study Together",
    href: "/study-together",
    icon: Handshake,
    description: "Virtual study rooms",
  },
  {
    title: "Statistics",
    href: "/statistics",
    icon: ChartColumn,
    description: "Productivity insights",
  },
  {
    title: "Progress",
    href: "/progress",
    icon: Trophy,
    description: "Streaks and achievements",
  },
];

export const bottomNav: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Profile and preferences",
  },
];
