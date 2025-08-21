import { useState, useEffect, useCallback } from "react";
import {
  addProcessingTask,
  updateProcessingTaskStatus,
  getPendingProcessingTasks,
  listenToProcessingQueue,
} from "@/lib/firestore";
import { ProcessingTask } from "@/lib/types";

export function useProcessingQueue(userId: string | null) {
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load pending tasks on mount
  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadTasks = async () => {
      try {
        const pendingTasks = await getPendingProcessingTasks();
        // Filter tasks for current user
        const userTasks = pendingTasks.filter((task) => task.userId === userId);
        setTasks(userTasks);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load processing tasks"
        );
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [userId]);

  // Set up real-time listener
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = listenToProcessingQueue((allTasks) => {
      // Filter tasks for current user
      const userTasks = allTasks.filter((task) => task.userId === userId);
      setTasks(userTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const addTask = useCallback(
    async (documentId: string, type: string) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        const taskId = await addProcessingTask(documentId, userId, type);
        return taskId;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add processing task";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const updateTaskStatus = useCallback(
    async (
      taskId: string,
      status: ProcessingTask["status"],
      errorMessage?: string
    ) => {
      try {
        setError(null);
        await updateProcessingTaskStatus(taskId, status, errorMessage);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update task status";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    []
  );

  const getTaskById = useCallback(
    (taskId: string) => {
      return tasks.find((task) => task.id === taskId);
    },
    [tasks]
  );

  const getTasksByStatus = useCallback(
    (status: ProcessingTask["status"]) => {
      return tasks.filter((task) => task.status === status);
    },
    [tasks]
  );

  const getTasksByDocument = useCallback(
    (documentId: string) => {
      return tasks.filter((task) => task.documentId === documentId);
    },
    [tasks]
  );

  const getPendingTasks = useCallback(() => {
    return tasks.filter((task) => task.status === "pending");
  }, [tasks]);

  const getProcessingTasks = useCallback(() => {
    return tasks.filter((task) => task.status === "processing");
  }, [tasks]);

  const getCompletedTasks = useCallback(() => {
    return tasks.filter((task) => task.status === "completed");
  }, [tasks]);

  const getFailedTasks = useCallback(() => {
    return tasks.filter((task) => task.status === "failed");
  }, [tasks]);

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTaskStatus,
    getTaskById,
    getTasksByStatus,
    getTasksByDocument,
    getPendingTasks,
    getProcessingTasks,
    getCompletedTasks,
    getFailedTasks,
  };
}
