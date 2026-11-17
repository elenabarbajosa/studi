"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Apple,
  CalendarPlus,
  CheckCircle2,
  Cloud,
  FileUp,
  Link2Off,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import {
  disconnectConnectionAction,
  importIcsAction,
  parseIcsPreviewAction,
  updateExternalCalendarSettingsAction,
  syncNowAction,
} from "@/actions/external-calendar";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import {
  EXTERNAL_CALENDAR_DESTINATIONS,
  EXTERNAL_CALENDAR_DESTINATION_LABELS,
  normalizeExternalCalendarDestination,
  type ExternalCalendarDestination,
} from "@/lib/calendar-sync/calendar-settings";
import { cn } from "@/lib/utils";
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ProviderConfigStatus,
} from "@/lib/calendar-sync/types";

type IntegrationStatus = {
  google: ProviderConfigStatus;
  microsoft: ProviderConfigStatus;
  icloud: ProviderConfigStatus;
  ics: ProviderConfigStatus;
  cronConfigured: boolean;
  encryptionConfigured: boolean;
};

type Step =
  | "providers"
  | "icloud"
  | "ics-review"
  | "manage";

export function ConnectCalendarDialog({
  open,
  onOpenChange,
  status,
  connections,
  calendars,
  initialManageConnectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: IntegrationStatus;
  connections: ExternalCalendarConnection[];
  calendars: ExternalCalendar[];
  initialManageConnectionId?: string | null;
}) {
  const [step, setStep] = useState<Step>(() =>
    initialManageConnectionId ? "manage" : "providers",
  );
  const [manageId, setManageId] = useState<string | null>(
    () => initialManageConnectionId ?? null,
  );
  const [icloudEmail, setIcloudEmail] = useState("");
  const [icloudPassword, setIcloudPassword] = useState("");
  const [icsFileName, setIcsFileName] = useState("");
  const [icsBase64, setIcsBase64] = useState("");
  const [icsEvents, setIcsEvents] = useState<
    Array<{
      providerEventId: string;
      title: string;
      startsAt: string;
      endsAt: string | null;
      allDay: boolean;
      isCancelled: boolean;
    }>
  >([]);
  const [icsSelected, setIcsSelected] = useState<Set<string>>(new Set());
  const [icsTruncated, setIcsTruncated] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeConnections = useMemo(
    () => connections.filter((c) => c.status !== "disconnected"),
    [connections],
  );

  const manageConnection = activeConnections.find((c) => c.id === manageId) ?? null;
  const manageCalendars = calendars.filter((c) => c.connection_id === manageId);

  const title =
    step === "icloud"
      ? "Connect Apple iCloud"
      : step === "ics-review"
        ? "Review ICS import"
        : step === "manage"
          ? "Manage calendar"
          : "Connect your calendar";

  const description =
    step === "providers"
      ? "Bring your schedule into Studi and plan around your real life."
      : step === "icloud"
        ? "Use an app-specific password — never your main Apple Account password."
        : step === "ics-review"
          ? "One-time import. This will not stay synchronized."
          : manageConnection
            ? `${providerLabel(manageConnection.provider)} · ${manageConnection.account_label ?? "Connected"}`
            : undefined;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="md:w-[min(560px,calc(100vw-48px))]"
      contentClassName="px-5 pb-5 md:px-6"
    >
      {step === "providers" ? (
        <div className="flex flex-col gap-3">
          {activeConnections.length > 0 ? (
            <div className="rounded-[16px] bg-sunken p-3">
              <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-3">
                Connected
              </p>
              <ul className="flex flex-col gap-2">
                {activeConnections.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-[12px] bg-raised px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {providerLabel(c.provider)}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-2">
                        {c.account_label ?? c.account_email ?? c.status}
                        {(() => {
                          const sync = formatConnectionSyncLine(c);
                          return sync ? ` · ${sync}` : "";
                        })()}
                        {c.status === "needs_reauth" ? " · Reconnect required" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={softPillClass}
                      onClick={() => {
                        setManageId(c.id);
                        setStep("manage");
                      }}
                    >
                      <Settings2 className="size-3.5" aria-hidden />
                      Manage
                    </button>
                  </li>
                ))}
              </ul>
              {!status.cronConfigured ? (
                <p className="mt-2 text-[12px] text-ink-3">
                  Background sync is not active yet. Use Sync now, or set CRON_SECRET
                  in Vercel (and ensure the daily cron is deployed).
                </p>
              ) : null}
            </div>
          ) : null}

          <ProviderCard
            title="Google Calendar"
            badge="Recommended"
            detail="Automatic synchronization"
            configured={status.google.configured}
            missing={status.google.missing}
            href="/api/calendar/oauth/google/start?next=/calendar"
            actionLabel="Connect with Google"
            icon={<Cloud className="size-5 text-ink" aria-hidden />}
          />
          <ProviderCard
            title="Microsoft Outlook"
            badge="Recommended"
            detail="Automatic synchronization"
            configured={status.microsoft.configured}
            missing={status.microsoft.missing}
            href="/api/calendar/oauth/microsoft/start?next=/calendar"
            actionLabel="Connect with Microsoft"
            icon={<CalendarPlus className="size-5 text-ink" aria-hidden />}
          />
          <ProviderCard
            title="Apple iCloud Calendar"
            badge="Private calendar connection"
            detail="Guided setup with an app-specific password · Automatic synchronization"
            configured={status.icloud.configured}
            missing={status.icloud.missing}
            onClick={() => setStep("icloud")}
            actionLabel="Set up iCloud"
            icon={<Apple className="size-5 text-ink" aria-hidden />}
          />
          <ProviderCard
            title="Import .ics file"
            badge="Manual, one-time"
            detail="Not an automatically synchronized connection"
            configured
            missing={[]}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".ics,text/calendar";
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  toast.error("File is too large (max 2 MB).");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const result = String(reader.result ?? "");
                  const base64 = result.includes(",")
                    ? result.split(",")[1] ?? ""
                    : result;
                  setIcsFileName(file.name);
                  setIcsBase64(base64);
                  startTransition(async () => {
                    const preview = await parseIcsPreviewAction({
                      contentBase64: base64,
                    });
                    if (!preview.ok) {
                      toast.error(preview.error);
                      return;
                    }
                    setIcsEvents(preview.data?.events ?? []);
                    setIcsTruncated(Boolean(preview.data?.truncated));
                    setIcsSelected(
                      new Set(
                        (preview.data?.events ?? [])
                          .filter((e) => !e.isCancelled)
                          .map((e) => e.providerEventId),
                      ),
                    );
                    setStep("ics-review");
                  });
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }}
            actionLabel="Choose .ics file"
            icon={<FileUp className="size-5 text-ink" aria-hidden />}
            pending={pending}
          />
        </div>
      ) : null}

      {step === "icloud" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              // Route Handler (not Server Action) so app-specific passwords
              // are never printed in Next.js Server Function argument traces.
              const res = await fetch("/api/calendar/icloud/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  appleIdEmail: icloudEmail,
                  appSpecificPassword: icloudPassword,
                }),
              });
              const result = (await res.json().catch(() => null)) as
                | { ok: true; success?: string }
                | { ok: false; error?: string }
                | null;
              if (!result?.ok) {
                toast.error(
                  result && "error" in result && result.error
                    ? result.error
                    : "iCloud connection failed.",
                );
                return;
              }
              toast.success(result.success ?? "Connected");
              setIcloudPassword("");
              onOpenChange(false);
            });
          }}
        >
          <ol className="list-decimal space-y-1.5 rounded-[16px] bg-sunken px-4 py-3 pl-8 text-[13px] text-ink-2">
            <li>
              Open{" "}
              <a
                className="font-semibold text-accent-ink underline-offset-2 hover:underline"
                href="https://account.apple.com"
                target="_blank"
                rel="noreferrer"
              >
                account.apple.com
              </a>{" "}
              and sign in.
            </li>
            <li>Sign-In and Security → App-Specific Passwords → Generate.</li>
            <li>Paste that password below (never your main Apple password).</li>
            <li>
              To revoke later: same page → remove the Studi password, then Disconnect here.
            </li>
          </ol>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Apple Account email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={icloudEmail}
              onChange={(e) => setIcloudEmail(e.target.value)}
              className="h-11 rounded-[12px] border border-hairline bg-raised px-3 text-[14px] text-ink outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">App-specific password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={icloudPassword}
              onChange={(e) => setIcloudPassword(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              className="h-11 rounded-[12px] border border-hairline bg-raised px-3 text-[14px] text-ink outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            />
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              className={softPillClass}
              onClick={() => setStep("providers")}
            >
              Back
            </button>
            <button type="submit" className={primaryPillClass} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Connect iCloud
            </button>
          </div>
        </form>
      ) : null}

      {step === "ics-review" ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-2">
            File: <span className="font-semibold text-ink">{icsFileName}</span>
            {icsTruncated ? " (truncated to import limit)" : ""}
          </p>
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto rounded-[16px] bg-sunken p-2">
            {icsEvents.map((ev) => (
              <li key={ev.providerEventId}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[10px] px-2 py-1.5 hover:bg-raised">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={icsSelected.has(ev.providerEventId)}
                    disabled={ev.isCancelled}
                    onChange={(e) => {
                      setIcsSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(ev.providerEventId);
                        else next.delete(ev.providerEventId);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {ev.title}
                      {ev.isCancelled ? " (cancelled)" : ""}
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      {ev.allDay
                        ? ev.startsAt.slice(0, 10)
                        : new Date(ev.startsAt).toLocaleString()}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={softPillClass}
              onClick={() => setStep("providers")}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryPillClass}
              disabled={pending || icsSelected.size === 0}
              onClick={() => {
                startTransition(async () => {
                  const result = await importIcsAction({
                    filename: icsFileName,
                    contentBase64: icsBase64,
                    selectedProviderEventIds: [...icsSelected],
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(result.success ?? "Imported");
                  onOpenChange(false);
                });
              }}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Import selected
            </button>
          </div>
        </div>
      ) : null}

      {step === "manage" && manageConnection ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-[16px] bg-sunken p-3 text-[13px] text-ink-2">
            <p>
              Status:{" "}
              <span className="font-semibold text-ink">{manageConnection.status}</span>
            </p>
            <p>
              Last successful sync:{" "}
              {manageConnection.last_successful_sync_at
                ? formatRelative(manageConnection.last_successful_sync_at)
                : "Never"}
            </p>
            {manageConnection.last_sync_error ? (
              <p className="mt-1 text-accent-ink">
                Latest sync issue: {manageConnection.last_sync_error}
              </p>
            ) : null}
            {manageConnection.provider === "ics" ? (
              <p className="mt-1">This was a one-time ICS import (not synced).</p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-3">
              Calendars
            </p>
            <p className="mb-2 text-[12.5px] text-ink-3">
              Disable a calendar to hide it everywhere in Studi. Mapping only
              changes how events look — it never creates native exams or tasks.
            </p>
            <ul className="space-y-2">
              {manageCalendars.map((cal) => (
                <ManagedCalendarRow
                  key={cal.id}
                  calendar={cal}
                  accountLabel={
                    manageConnection.account_label ||
                    manageConnection.account_email ||
                    manageConnection.provider
                  }
                  pending={pending}
                  onUpdate={(patch) => {
                    startTransition(async () => {
                      const result = await updateExternalCalendarSettingsAction({
                        calendarId: cal.id,
                        ...patch,
                      });
                      if (!result.ok) toast.error(result.error);
                      else if (result.success) toast.success(result.success);
                    });
                  }}
                />
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={softPillClass}
              onClick={() => setStep("providers")}
            >
              Back
            </button>
            {manageConnection.provider !== "ics" ? (
              <button
                type="button"
                className={softPillClass}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await syncNowAction(manageConnection.id);
                    if (!result.ok) toast.error(result.error);
                    else toast.success(result.success ?? "Synced");
                  });
                }}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden />
                )}
                Sync now
              </button>
            ) : null}
            {(manageConnection.status === "needs_reauth" ||
              manageConnection.status === "error") &&
            (manageConnection.provider === "google" ||
              manageConnection.provider === "microsoft") ? (
              <a
                className={primaryPillClass}
                href={`/api/calendar/oauth/${manageConnection.provider}/start?next=/calendar`}
              >
                Reconnect
              </a>
            ) : null}
            <button
              type="button"
              className={cn(softPillClass, "text-accent-ink")}
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    "Disconnect and remove synced external events from Studi?",
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  const result = await disconnectConnectionAction(manageConnection.id);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(result.success ?? "Disconnected");
                    setStep("providers");
                    setManageId(null);
                  }
                });
              }}
            >
              <Link2Off className="size-3.5" aria-hidden />
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}

function ManagedCalendarRow({
  calendar,
  accountLabel,
  pending,
  onUpdate,
}: {
  calendar: ExternalCalendar;
  accountLabel: string;
  pending: boolean;
  onUpdate: (patch: {
    enabled?: boolean;
    studiDestination?: ExternalCalendarDestination;
    blocksStudy?: boolean;
  }) => void;
}) {
  const destination = normalizeExternalCalendarDestination(
    calendar.studi_destination,
  );
  const blocksStudy = calendar.blocks_study !== false;

  return (
    <li className="rounded-[14px] bg-raised px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ background: calendar.color || "var(--accent)" }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {calendar.name}
              </p>
              <p className="truncate text-[11.5px] text-ink-3">{accountLabel}</p>
              {calendar.last_sync_error ? (
                <p className="truncate text-[11.5px] text-accent-ink">
                  {calendar.last_sync_error}
                </p>
              ) : calendar.last_successful_sync_at ? (
                <p className="truncate text-[11.5px] text-ink-3">
                  Synced {formatRelative(calendar.last_successful_sync_at)}
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--accent)]"
                checked={calendar.enabled}
                disabled={pending}
                onChange={(e) => onUpdate({ enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>

          {calendar.enabled ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] text-ink-2">
                <span className="font-medium text-ink-3">Show in Studi as</span>
                <select
                  className="rounded-[10px] border border-hairline bg-sunken px-2.5 py-1.5 text-[13px] text-ink"
                  value={destination}
                  disabled={pending}
                  onChange={(e) =>
                    onUpdate({
                      studiDestination: e.target
                        .value as ExternalCalendarDestination,
                    })
                  }
                >
                  {EXTERNAL_CALENDAR_DESTINATIONS.map((value) => (
                    <option key={value} value={value}>
                      {EXTERNAL_CALENDAR_DESTINATION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-1 text-[12.5px] text-ink-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--accent)]"
                  checked={blocksStudy}
                  disabled={pending}
                  onChange={(e) => onUpdate({ blocksStudy: e.target.checked })}
                />
                Block study time
              </label>
            </div>
          ) : (
            <p className="text-[12px] text-ink-3">
              Disabled — events stay hidden from Calendar, suggestions, and the
              Study Planner.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function ProviderCard({
  title,
  badge,
  detail,
  configured,
  missing,
  href,
  onClick,
  actionLabel,
  icon,
  pending,
}: {
  title: string;
  badge: string;
  detail: string;
  configured: boolean;
  missing: string[];
  href?: string;
  onClick?: () => void;
  actionLabel: string;
  icon: React.ReactNode;
  pending?: boolean;
}) {
  const setupRequired = !configured;
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-sunken">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-ink">{title}</span>
          <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-2">
            {badge}
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-2">{detail}</span>
        {setupRequired ? (
          <span className="mt-1 flex items-center gap-1 text-[12.5px] font-medium text-accent-ink">
            Setup required
            {missing.length ? ` (${missing.join(", ")})` : ""}
          </span>
        ) : (
          <span className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-3">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Ready to connect
          </span>
        )}
      </span>
      <span className={cn(softPillClass, setupRequired && "opacity-60")}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {setupRequired ? "Setup required" : actionLabel}
      </span>
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-[18px] border border-hairline bg-raised p-3 text-left transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]";

  if (setupRequired) {
    return (
      <div className={className} aria-disabled>
        {body}
      </div>
    );
  }
  if (href) {
    return (
      <a className={className} href={href}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={pending}>
      {body}
    </button>
  );
}

function providerLabel(provider: string) {
  switch (provider) {
    case "google":
      return "Google Calendar";
    case "microsoft":
      return "Microsoft Outlook";
    case "icloud":
      return "Apple iCloud";
    case "ics":
      return "ICS import";
    default:
      return provider;
  }
}

function formatConnectionSyncLine(c: {
  last_successful_sync_at: string | null;
  last_sync_error: string | null;
}) {
  // Never show an unqualified "Synced just now" when the latest attempt failed.
  if (c.last_sync_error) {
    if (c.last_successful_sync_at) {
      return `Last successful sync ${formatRelative(c.last_successful_sync_at)} · ${c.last_sync_error}`;
    }
    return c.last_sync_error;
  }
  if (c.last_successful_sync_at) {
    return `Synced ${formatRelative(c.last_successful_sync_at)}`;
  }
  return "";
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
}
