"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteOwnRoomMessage, sendRoomMessage } from "@/actions/study-together";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type {
  RoomMemberProfile,
  StudyRoomMessage,
} from "@/lib/study-together/types";

type RoomChatProps = {
  roomId: string;
  userId: string;
  enabled: boolean;
  hidden: boolean;
  initialMessages: StudyRoomMessage[];
  members: RoomMemberProfile[];
};

export function RoomChat({
  roomId,
  userId,
  enabled,
  hidden,
  initialMessages,
  members,
}: RoomChatProps) {
  const [liveMessages, setLiveMessages] = useState<StudyRoomMessage[]>([]);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialIdsRef = useRef(new Set(initialMessages.map((m) => m.id)));
  const nameById = new Map(
    members.map((m) => [m.id, m.display_name || m.username]),
  );
  const messages = [...initialMessages, ...liveMessages].filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
  );

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (hidden) {
    return (
      <div className="studi-panel p-4 text-sm text-muted-foreground">
        Chat is hidden during focus. It opens again on breaks.
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="studi-panel p-4 text-sm text-muted-foreground">
        Chat is disabled for this room.
      </div>
    );
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const clientMessageId = crypto.randomUUID();
    setBody("");
    startTransition(async () => {
      const result = await sendRoomMessage(roomId, text, clientMessageId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="studi-panel flex h-[28rem] flex-col p-4">
      <h3 className="mb-3 font-medium">Room chat</h3>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
        {messages
          .filter((m) => !m.deleted_at)
          .map((m) => (
            <li key={m.id} className="group">
              <p className="text-xs text-muted-foreground">
                {nameById.get(m.sender_id) ?? "Member"} ·{" "}
                {new Date(m.created_at).toLocaleTimeString()}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {m.sender_id === userId ? (
                <button
                  type="button"
                  className="mt-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100"
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
            </li>
          ))}
        <div ref={bottomRef} />
      </ul>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder="Message…"
          disabled={isPending}
        />
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
