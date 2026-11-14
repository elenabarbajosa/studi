"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, Minus, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { createStudyRoom } from "@/actions/study-together";
import { Field, FormError, PrimaryActions, SwitchRow } from "@/components/studi/form-controls";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudyRoomVisibility } from "@/lib/study-together/types";
import { cn } from "@/lib/utils";

type Rhythm = { focus: number; short: number; long: number; every: number };

const PRESETS: { id: string; label: string; rhythm: Rhythm }[] = [
  { id: "classic", label: "Classic", rhythm: { focus: 25, short: 5, long: 15, every: 4 } },
  { id: "deep", label: "Deep work", rhythm: { focus: 50, short: 10, long: 20, every: 3 } },
  { id: "sprint", label: "Sprint", rhythm: { focus: 15, short: 3, long: 10, every: 4 } },
];

const STEPS = ["Room", "Rhythm", "Options"] as const;

export function CreateRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New study room">
      {open ? <CreateRoomSteps onDone={() => onOpenChange(false)} /> : null}
    </ResponsiveDialog>
  );
}

function CreateRoomSteps({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<StudyRoomVisibility>("private");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [rhythm, setRhythm] = useState<Rhythm>(PRESETS[0].rhythm);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [membersCanInvite, setMembersCanInvite] = useState(false);

  const presetId =
    PRESETS.find(
      (p) =>
        p.rhythm.focus === rhythm.focus &&
        p.rhythm.short === rhythm.short &&
        p.rhythm.long === rhythm.long &&
        p.rhythm.every === rhythm.every,
    )?.id ?? "custom";

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await createStudyRoom({
        name,
        description,
        visibility,
        max_participants: maxParticipants,
        focus_minutes: rhythm.focus,
        short_break_minutes: rhythm.short,
        long_break_minutes: rhythm.long,
        intervals_before_long: rhythm.every,
        chat_enabled: chatEnabled,
        members_can_invite: membersCanInvite,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Room created");
      onDone();
      if (result.roomId) router.push(`/study-together/${result.roomId}`);
    });
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step === 0 && !name.trim()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit();
  }

  return (
    <form onSubmit={next} className="flex flex-col gap-5">
      <ol className="flex gap-1.5" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1 rounded-full transition-colors duration-300 ease-studi",
                i <= step ? "bg-accent-ink dark:bg-accent" : "bg-sunken",
              )}
            />
            <span
              className={cn("text-[12px] font-medium", i === step ? "text-ink" : "text-ink-3")}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <Field label="Room name" htmlFor="room-name">
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder="Late library"
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="room-desc" optional>
            <Textarea
              id="room-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={280}
              className="min-h-16"
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Who can join</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <VisibilityOption
                selected={visibility === "private"}
                onSelect={() => setVisibility("private")}
                icon={Lock}
                title="Private"
                body="Only people you invite."
              />
              <VisibilityOption
                selected={visibility === "friends"}
                onSelect={() => setVisibility("friends")}
                icon={Users}
                title="Friends only"
                body="Your friends can join from their hub."
              />
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Rhythm preset">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={presetId === p.id}
                onClick={() => setRhythm(p.rhythm)}
                className={cn(
                  "flex flex-col items-start rounded-[16px] px-3 py-2.5 text-left outline-none transition-colors duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                  presetId === p.id ? "bg-accent-soft text-accent-text" : "bg-sunken text-ink hover:bg-hover",
                )}
              >
                <span className="text-[13.5px] font-semibold">{p.label}</span>
                <span className="text-[12px] opacity-75 tabular-nums">
                  {p.rhythm.focus}/{p.rhythm.short} · ×{p.rhythm.every}
                </span>
              </button>
            ))}
            <span
              className={cn(
                "flex flex-col items-start rounded-[16px] px-3 py-2.5",
                presetId === "custom" ? "bg-accent-soft text-accent-text" : "bg-sunken text-ink-3",
              )}
              aria-hidden
            >
              <span className="text-[13.5px] font-semibold">Custom</span>
              <span className="text-[12px] opacity-75">Use the sliders</span>
            </span>
          </div>

          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <RangeField id="r-focus" label="Focus" unit="min" min={5} max={120} step={5} value={rhythm.focus} onChange={(v) => setRhythm({ ...rhythm, focus: v })} />
            <RangeField id="r-short" label="Short break" unit="min" min={1} max={30} value={rhythm.short} onChange={(v) => setRhythm({ ...rhythm, short: v })} />
            <RangeField id="r-long" label="Long break" unit="min" min={5} max={60} step={5} value={rhythm.long} onChange={(v) => setRhythm({ ...rhythm, long: v })} />
            <RangeField id="r-every" label="Long break every" unit="cycles" min={2} max={8} value={rhythm.every} onChange={(v) => setRhythm({ ...rhythm, every: v })} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-sunken px-3.5 py-2">
            <span className="text-[14px] text-ink" id="max-p-label">
              Max participants
            </span>
            <div className="flex items-center gap-1" role="group" aria-labelledby="max-p-label">
              <StepButton label="Fewer" disabled={maxParticipants <= 2} onClick={() => setMaxParticipants(maxParticipants - 1)}>
                <Minus className="size-4" aria-hidden />
              </StepButton>
              <output className="w-8 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
                {maxParticipants}
              </output>
              <StepButton label="More" disabled={maxParticipants >= 16} onClick={() => setMaxParticipants(maxParticipants + 1)}>
                <Plus className="size-4" aria-hidden />
              </StepButton>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <SwitchRow label="Room chat during breaks" checked={chatEnabled} onChange={setChatEnabled} />
          <SwitchRow label="Members can invite friends" checked={membersCanInvite} onChange={setMembersCanInvite} />
          <div className="mt-1 rounded-[18px] bg-accent-soft px-4 py-3 text-[13.5px] text-ink">
            <p className="font-semibold">{name.trim() || "Untitled room"}</p>
            <p className="mt-0.5 text-ink-2">
              {visibility === "private" ? "Private" : "Friends only"} · up to {maxParticipants} people ·{" "}
              {rhythm.focus}/{rhythm.short} min, long {rhythm.long} every {rhythm.every}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              Your subject and goal stay private to you inside the room.
            </p>
          </div>
        </div>
      ) : null}

      <FormError message={error} />

      <PrimaryActions className="justify-between">
        {step > 0 ? (
          <button type="button" className={softPillClass} onClick={() => setStep(step - 1)} disabled={isPending}>
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          className={primaryPillClass}
          disabled={isPending || (step === 0 && !name.trim())}
        >
          {step < STEPS.length - 1 ? "Continue" : isPending ? "Creating…" : "Create room"}
        </button>
      </PrimaryActions>
    </form>
  );
}

function VisibilityOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-[18px] p-3.5 text-left outline-none transition-[background-color,box-shadow] duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
        selected ? "bg-accent-soft shadow-[0_0_0_1.5px_var(--accent)]" : "bg-sunken hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-raised text-accent-text" : "bg-raised text-ink-2",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-2">{body}</span>
      </span>
    </button>
  );
}

function RangeField({
  id,
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[13px]">
        <label htmlFor={id} className="font-medium text-ink-2">
          {label}
        </label>
        <span className="font-semibold text-ink tabular-nums">
          {value} <span className="font-normal text-ink-3">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full bg-raised text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--sunken),0_0_0_4px_var(--accent)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
