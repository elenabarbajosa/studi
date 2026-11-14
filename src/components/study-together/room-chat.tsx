"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Coffee, Flame, Heart, Lock, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { deleteOwnRoomMessage, sendRoomMessage } from "@/actions/study-together";
import { createClient } from "@/lib/supabase/client";
import type {
  RoomMemberProfile,
  StudyRoomMessage,
} from "@/lib/study-together/types";
import { cn } from "@/lib/utils";

type RoomChatProps = {
  roomId: string;
  userId: string;
  enabled: boolean;
  hidden: boolean;
  initialMessages: StudyRoomMessage[];
  members: RoomMemberProfile[];
  className?: string;
};

const QUICK = [
  { icon: Heart, label: "Cheer", body: "Cheering you on!", tint: "text-accent" },
  { icon: Flame, label: "Keep going", body: "Keep going!", tint: "text-[#E0A84F]" },
  { icon: Coffee, label: "Brb", body: "Brb", tint: "text-white/70" },
] as const;

export function RoomChat({
  roomId,
  userId,
  enabled,
  hidden,
  initialMessages,
  members,
  className,
}: RoomChatProps) {
  const [liveMessages, setLiveMessages] = useState<StudyRoomMessage[]>([]);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const initialIdsRef = useRef(new Set(initialMessages.map((m) => m.id)));
  const nameById = new Map(
    members.map((m) => [m.id, m.display_name || m.username]),
  );
  const messages = [...initialMessages, ...liveMessages].filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
  );
  const visible = messages.filter((m) => !m.deleted_at);

  useEffect(() => {
    initialIdsRef.current = new Set(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as StudyRoomMessage;
            setLiveMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              if (initialIdsRef.current.has(row.id)) return prev;
              return [...prev, row];
            });
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as StudyRoomMessage;
            setLiveMessages((prev) => {
              const exists = prev.some((m) => m.id === row.id);
              if (exists) {
                return prev.map((m) => (m.id === row.id ? row : m));
              }
              return [...prev, row];
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [visible.length]);

  function post(text: string) {
    const clientMessageId = crypto.randomUUID();
    startTransition(async () => {
      const result = await sendRoomMessage(roomId, text, clientMessageId);
      if (result.error) toast.error(result.error);
    });
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    post(text);
  }

  return (
    <section
      aria-label="Room chat"
      className={cn("flex min-h-0 flex-col text-[#F3ECEE]", className)}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="text-[15px] font-semibold">Chat</h2>
        {!enabled ? (
          <span className="text-[12px] text-white/50">Off for this room</span>
        ) : hidden ? (
          <span className="flex items-center gap-1.5 text-[12px] text-white/60">
            <Lock className="size-3" aria-hidden />
            Opens at the break
          </span>
        ) : (
          <span className="text-[12px] text-success">Open</span>
        )}
      </div>

      {!enabled ? (
        <p className="px-5 pb-5 text-[13.5px] text-white/55">
          The host turned chat off. Presence and the shared timer still work.
        </p>
      ) : (
        <>
          <ul
            ref={listRef}
            aria-live="polite"
            className={cn(
              "flex min-h-[160px] flex-1 flex-col gap-3.5 overflow-y-auto px-5 transition-opacity duration-300",
              hidden && "pointer-events-none opacity-50 select-none",
            )}
          >
            {visible.length === 0 ? (
              <li className="m-auto text-center text-[13px] text-white/45">
                No messages yet. Say hi when the break starts.
              </li>
            ) : null}
            {visible.map((m) => {
              const name = nameById.get(m.sender_id) ?? "Member";
              const mine = m.sender_id === userId;
              return (
                <li key={m.id} className="group flex gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold uppercase",
                      mine ? "bg-accent text-[#241c1f]" : "bg-white/10 text-white/80",
                    )}
                  >
                    {name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white/55">
                      <strong className="font-semibold text-[#F3ECEE]">{mine ? "You" : name}</strong> ·{" "}
                      {new Date(m.created_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {mine && !hidden ? (
                        <button
                          type="button"
                          className="ml-2 rounded text-[11px] text-white/45 opacity-0 outline-none group-hover:opacity-100 hover:text-white focus-visible:opacity-100 focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteOwnRoomMessage(m.id, roomId);
                              if (result.error) toast.error(result.error);
                            })
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </p>
                    <p className="text-[13.5px] leading-snug break-words whitespace-pre-wrap">
                      {m.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">
            <div className="flex gap-1.5">
              {QUICK.map(({ icon: Icon, label, body: text, tint }) => (
                <button
                  key={label}
                  type="button"
                  disabled={hidden || isPending}
                  onClick={() => post(text)}
                  className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[12.5px] text-white/70 outline-none transition-colors hover:bg-white/[0.12] focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)] disabled:opacity-40"
                >
                  <Icon className={cn("size-3.5", tint)} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {hidden ? (
              <p className="flex h-11 items-center gap-2 rounded-[14px] bg-white/[0.07] px-3.5 text-[13.5px] text-white/45">
                <Lock className="size-3.5" aria-hidden />
                Messages unlock during the break
              </p>
            ) : (
              <form onSubmit={send} className="flex gap-2">
                <label htmlFor="room-chat-input" className="sr-only">
                  Message
                </label>
                <input
                  id="room-chat-input"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={500}
                  placeholder="Message…"
                  disabled={isPending}
                  autoComplete="off"
                  className="h-11 min-w-0 flex-1 rounded-[14px] bg-white/[0.07] px-3.5 text-base text-[#F3ECEE] outline-none placeholder:text-white/40 focus-visible:shadow-[0_0_0_2px_var(--accent)] md:text-[13.5px]"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={isPending || !body.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent text-[#241c1f] outline-none focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)] disabled:opacity-40"
                >
                  <SendHorizontal className="size-4" aria-hidden />
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </section>
  );
}
