export const STUDY_ROOM_VISIBILITIES = ["private", "friends"] as const;
export type StudyRoomVisibility = (typeof STUDY_ROOM_VISIBILITIES)[number];

export const STUDY_ROOM_STATUSES = ["active", "ended"] as const;
export type StudyRoomStatus = (typeof STUDY_ROOM_STATUSES)[number];

export const STUDY_ROOM_PHASES = [
  "idle",
  "focus",
  "short_break",
  "long_break",
] as const;
export type StudyRoomPhase = (typeof STUDY_ROOM_PHASES)[number];

export const STUDY_ROOM_RUN_STATES = ["idle", "running", "paused"] as const;
export type StudyRoomRunState = (typeof STUDY_ROOM_RUN_STATES)[number];

export const STUDY_ROOM_MEMBER_ROLES = ["host", "member"] as const;
export type StudyRoomMemberRole = (typeof STUDY_ROOM_MEMBER_ROLES)[number];

export const STUDY_ROOM_MEMBER_STATUSES = ["active", "left"] as const;
export type StudyRoomMemberStatus = (typeof STUDY_ROOM_MEMBER_STATUSES)[number];

export const STUDY_ROOM_INVITE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
] as const;
export type StudyRoomInviteStatus = (typeof STUDY_ROOM_INVITE_STATUSES)[number];

export const ROOM_TIMER_ACTIONS = [
  "start",
  "pause",
  "resume",
  "skip",
  "reset",
  "next_cycle",
] as const;
export type RoomTimerAction = (typeof ROOM_TIMER_ACTIONS)[number];

export const ROOM_PRESENCE_STATUSES = [
  "focusing",
  "on_break",
  "idle",
] as const;
export type RoomPresenceStatus = (typeof ROOM_PRESENCE_STATUSES)[number];

export type StudyRoom = {
  id: string;
  name: string;
  description: string | null;
  host_id: string;
  visibility: StudyRoomVisibility;
  max_participants: number;
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  intervals_before_long: number;
  chat_enabled: boolean;
  members_can_invite: boolean;
  status: StudyRoomStatus;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type StudyRoomMember = {
  room_id: string;
  user_id: string;
  role: StudyRoomMemberRole;
  status: StudyRoomMemberStatus;
  joined_at: string;
  left_at: string | null;
};

export type StudyRoomInvitation = {
  id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  token_hash: string;
  status: StudyRoomInviteStatus;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
};

export type StudyRoomTimerState = {
  room_id: string;
  phase: StudyRoomPhase;
  run_state: StudyRoomRunState;
  phase_duration_ms: number;
  phase_started_at: string | null;
  phase_ends_at: string | null;
  remaining_ms_when_paused: number | null;
  cycle_number: number;
  completed_focus_intervals: number;
  revision: number;
  updated_at: string;
  updated_by: string | null;
};

export type StudyRoomMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  client_message_id: string;
  created_at: string;
  deleted_at: string | null;
};

export type RoomMemberProfile = {
  id: string;
  username: string;
  display_name: string | null;
  accent_color: string;
  avatar_preference: string;
  avatarSrc: string | null;
  role: StudyRoomMemberRole;
  isHost: boolean;
};

export function phaseLabel(phase: StudyRoomPhase) {
  switch (phase) {
    case "focus":
      return "Focus";
    case "short_break":
      return "Short break";
    case "long_break":
      return "Long break";
    default:
      return "Idle";
  }
}

export function isBreakPhase(phase: StudyRoomPhase) {
  return phase === "short_break" || phase === "long_break";
}
