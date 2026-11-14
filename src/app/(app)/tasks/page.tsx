import { Suspense } from "react";

import { TasksBoard, type TaskView } from "@/components/tasks/tasks-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listSubtasksForTasks, listTasks } from "@/lib/data/calendar";
import { listAllTopics, listSubjects } from "@/lib/data/subjects";

export const metadata = { title: "Tasks" };

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseView(value: string | string[] | undefined): TaskView {
  const v = Array.isArray(value) ? value[0] : value;
  if (
    v === "today" ||
    v === "upcoming" ||
    v === "all" ||
    v === "completed"
  ) {
    return v;
  }
  return "today";
}

async function TasksContent({ searchParams }: TasksPageProps) {
  await requireProfile();
  const params = await searchParams;
  const [tasks, subjects, topics] = await Promise.all([
    listTasks(),
    listSubjects(),
    listAllTopics(),
  ]);
  const subtasks = await listSubtasksForTasks(tasks.map((t) => t.id));

  return (
    <TasksBoard
      tasks={tasks}
      subtasks={subtasks}
      subjects={subjects}
      topics={topics}
      initialView={parseView(params.view)}
    />
  );
}

function TasksFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4" aria-busy="true" aria-label="Loading tasks">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="hidden h-9 w-80 rounded-full md:block" />
      </div>
      <Skeleton className="h-8 w-full max-w-lg rounded-full" />
      <Skeleton className="hidden h-[50px] w-full rounded-[14px] md:block" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[52px] w-full rounded-[14px]" />
      ))}
    </div>
  );
}

export default function TasksPage(props: TasksPageProps) {
  return (
    <Suspense fallback={<TasksFallback />}>
      <TasksContent {...props} />
    </Suspense>
  );
}
