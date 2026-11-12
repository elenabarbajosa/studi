import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  Focus,
  Handshake,
  LayoutDashboard,
  Settings,
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
    comingSoon: true,
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
    comingSoon: true,
  },
  {
    title: "Friends",
    href: "/friends",
    icon: Users,
    description: "Study companions",
    comingSoon: true,
  },
  {
    title: "Study Together",
    href: "/study-together",
    icon: Handshake,
    description: "Virtual study rooms",
    comingSoon: true,
  },
  {
    title: "Statistics",
    href: "/statistics",
    icon: ChartColumn,
    description: "Productivity insights",
    comingSoon: true,
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
