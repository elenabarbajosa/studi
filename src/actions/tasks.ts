"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { subtaskSchema, taskSchema } from "@/lib/validations/phase3";

export type ActionState = { error?: string; success?: string };

async function authClient() {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." } as const;
  return { supabase, user } as const;
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

function dueAtFromForm(dueDate?: string | null, dueTime?: string | null) {
  if (!dueDate) return null;
  if (dueTime) return new Date(`${dueDate}T${dueTime}:00`).toISOString();
  return new Date(`${dueDate}T23:59:59`).toISOString();
}

function scheduleFromForm(
  date?: string | null,
  start?: string | null,
  end?: string | null,
) {
  if (!date || !start) return { scheduled_start: null, scheduled_end: null };
  const scheduled_start = new Date(`${date}T${start}:00`).toISOString();
  const scheduled_end = end
    ? new Date(`${date}T${end}:00`).toISOString()
    : new Date(new Date(`${date}T${start}:00`).getTime() + 60 * 60 * 1000).toISOString();
  return { scheduled_start, scheduled_end };
}

export async function createTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    subject_id: formData.get("subject_id") || null,
    topic_id: formData.get("topic_id") || null,
    due_date: formData.get("due_date") || "",
    due_time: formData.get("due_time") || "",
    scheduled_date: formData.get("scheduled_date") || "",
    scheduled_start_time: formData.get("scheduled_start_time") || "",
    scheduled_end_time: formData.get("scheduled_end_time") || "",
    priority: formData.get("priority") || "medium",
    estimated_minutes: formData.get("estimated_minutes"),
    status: formData.get("status") || "todo",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task" };
  }

  const schedule = scheduleFromForm(
    parsed.data.scheduled_date,
    parsed.data.scheduled_start_time,
    parsed.data.scheduled_end_time,
  );

  const { error } = await auth.supabase.from("tasks").insert({
    user_id: auth.user.id,
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || null,
    subject_id: parsed.data.subject_id || null,
    topic_id: parsed.data.topic_id || null,
    due_at: dueAtFromForm(parsed.data.due_date, parsed.data.due_time),
    scheduled_start: schedule.scheduled_start,
    scheduled_end: schedule.scheduled_end,
    priority: parsed.data.priority,
    estimated_minutes: parsed.data.estimated_minutes,
    status: parsed.data.status ?? "todo",
  });

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Task created" };
}

export async function updateTask(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    subject_id: formData.get("subject_id") || null,
    topic_id: formData.get("topic_id") || null,
    due_date: formData.get("due_date") || "",
    due_time: formData.get("due_time") || "",
    scheduled_date: formData.get("scheduled_date") || "",
    scheduled_start_time: formData.get("scheduled_start_time") || "",
    scheduled_end_time: formData.get("scheduled_end_time") || "",
    priority: formData.get("priority") || "medium",
    estimated_minutes: formData.get("estimated_minutes"),
    status: formData.get("status") || "todo",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task" };
  }

  const schedule = scheduleFromForm(
    parsed.data.scheduled_date,
    parsed.data.scheduled_start_time,
    parsed.data.scheduled_end_time,
  );

  const { error } = await auth.supabase
    .from("tasks")
    .update({
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      subject_id: parsed.data.subject_id || null,
      topic_id: parsed.data.topic_id || null,
      due_at: dueAtFromForm(parsed.data.due_date, parsed.data.due_time),
      scheduled_start: schedule.scheduled_start,
      scheduled_end: schedule.scheduled_end,
      priority: parsed.data.priority,
      estimated_minutes: parsed.data.estimated_minutes,
      status: parsed.data.status ?? "todo",
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Task updated" };
}

export async function setTaskStatus(
  id: string,
  status: "todo" | "completed",
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: status === "completed" ? "Completed" : "Reopened" };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Task deleted" };
}

export async function createSubtask(
  taskId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = subtaskSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subtask" };
  }

  const { count } = await auth.supabase
    .from("subtasks")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("user_id", auth.user.id);

  const { error } = await auth.supabase.from("subtasks").insert({
    user_id: auth.user.id,
    task_id: taskId,
    title: parsed.data.title.trim(),
    sort_order: count ?? 0,
  });

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Subtask added" };
}

export async function toggleSubtask(
  id: string,
  completed: boolean,
): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("subtasks")
    .update({ completed })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Updated" };
}

export async function deleteSubtask(id: string): Promise<ActionState> {
  const auth = await authClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("subtasks")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };
  revalidateTasks();
  return { success: "Subtask deleted" };
}
