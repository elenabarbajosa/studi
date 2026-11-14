"use client";

import { createContext, useContext, useState } from "react";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { toDateKey } from "@/lib/planning";
import type { Subject, Topic } from "@/types/database";

const NewTaskContext = createContext<(() => void) | null>(null);

export function NewTaskProvider({
  subjects,
  topics,
  children,
}: {
  subjects: Subject[];
  topics: Topic[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <NewTaskContext.Provider value={() => setOpen(true)}>
      {children}
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        subjects={subjects}
        topics={topics}
        // Dashboard → Today: default due date to today so new tasks appear in this tile.
        // Clearing the date keeps the task undated (not falsely labeled due today).
        draft={{ dueDate: toDateKey(new Date()) }}
      />
    </NewTaskContext.Provider>
  );
}

export function useOpenNewTask() {
  const open = useContext(NewTaskContext);
  if (!open) throw new Error("useOpenNewTask must be used inside NewTaskProvider");
  return open;
}
