import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
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
    <div>
      <PageHeader
        title="Tasks"
        description="Personal to-dos with due dates, priorities, and optional study blocks."
      />
      <TasksBoard
        tasks={tasks}
        subtasks={subtasks}
        subjects={subjects}
        topics={topics}
        initialView={parseView(params.view)}
      />
    </div>
  );
}

function TasksFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
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
