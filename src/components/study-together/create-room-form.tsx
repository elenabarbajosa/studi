"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createStudyRoom } from "@/actions/study-together";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudyRoomVisibility } from "@/lib/study-together/types";

export function CreateRoomForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<StudyRoomVisibility>("private");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreak, setShortBreak] = useState(5);
  const [longBreak, setLongBreak] = useState(15);
  const [intervals, setIntervals] = useState(4);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [membersCanInvite, setMembersCanInvite] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createStudyRoom({
        name,
        description,
        visibility,
        max_participants: maxParticipants,
        focus_minutes: focusMinutes,
        short_break_minutes: shortBreak,
        long_break_minutes: longBreak,
        intervals_before_long: intervals,
        chat_enabled: chatEnabled,
        members_can_invite: membersCanInvite,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Room created");
      if (result.roomId) router.push(`/study-together/${result.roomId}`);
    });
  }

  return (
    <form onSubmit={submit} className="studi-panel space-y-4 p-6">
      <div>
        <h2 className="font-display text-xl tracking-tight">Create study room</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Private rooms need invitations. Friends-only rooms are joinable by friends of the host.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Evening focus"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="room-desc">Description (optional)</Label>
          <Textarea
            id="room-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={280}
          />
        </div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <div className="flex flex-wrap gap-2">
            {(["private", "friends"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={
                  visibility === v
                    ? "rounded-xl border border-primary bg-brand-soft px-3 py-1.5 text-sm capitalize"
                    : "rounded-xl border border-border px-3 py-1.5 text-sm capitalize hover:bg-muted/60"
                }
              >
                {v === "friends" ? "Friends only" : "Private"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-p">Max participants</Label>
          <Input
            id="max-p"
            type="number"
            min={2}
            max={16}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-m">Focus (min)</Label>
          <Input
            id="focus-m"
            type="number"
            min={5}
            max={120}
            value={focusMinutes}
            onChange={(e) => setFocusMinutes(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="short-m">Short break</Label>
          <Input
            id="short-m"
            type="number"
            min={1}
            max={30}
            value={shortBreak}
            onChange={(e) => setShortBreak(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="long-m">Long break</Label>
          <Input
            id="long-m"
            type="number"
            min={5}
            max={60}
            value={longBreak}
            onChange={(e) => setLongBreak(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervals">Long break every</Label>
          <Input
            id="intervals"
            type="number"
            min={2}
            max={8}
            value={intervals}
            onChange={(e) => setIntervals(Number(e.target.value))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={chatEnabled}
          onChange={(e) => setChatEnabled(e.target.checked)}
        />
        Enable room chat
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={membersCanInvite}
          onChange={(e) => setMembersCanInvite(e.target.checked)}
        />
        Members may invite friends
      </label>

      <Button type="submit" disabled={isPending || !name.trim()}>
        {isPending ? "Creating…" : "Create room"}
      </Button>
    </form>
  );
}
