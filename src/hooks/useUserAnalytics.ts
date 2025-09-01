import { useState, useEffect, useCallback } from "react";
import { Timestamp } from "firebase/firestore";
import { getUserAnalytics, trackFeatureUsage } from "@/lib/firestore";
import { UserAnalytics } from "@/lib/types";

export function useUserAnalytics(userId: string | null) {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user analytics on mount
  useEffect(() => {
    if (!userId) {
      setAnalytics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadAnalytics = async () => {
      try {
        const userAnalytics = await getUserAnalytics(userId);
        setAnalytics(userAnalytics);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load user analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [userId]);

  const trackFeature = useCallback(
    async (feature: string, increment: number = 1) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        await trackFeatureUsage(userId, feature, increment);

        // Update local state
        if (analytics) {
          const currentUsage = analytics.featureUsage[feature] || 0;
          const newUsage = currentUsage + increment;

          setAnalytics((prev) =>
            prev
              ? {
                  ...prev,
                  featureUsage: {
                    ...prev.featureUsage,
                    [feature]: newUsage,
                  },
                  lastActiveDate: Timestamp.now(),
                }
              : null
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to track feature usage";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId, analytics]
  );

  const getFeatureUsage = useCallback(
    (feature: string) => {
      return analytics?.featureUsage[feature] || 0;
    },
    [analytics]
  );

  const getTotalFeatureUsage = useCallback(() => {
    if (!analytics) return 0;
    return Object.values(analytics.featureUsage).reduce(
      (sum, usage) => sum + usage,
      0
    );
  }, [analytics]);

  const getMostUsedFeatures = useCallback(
    (limit: number = 5) => {
      if (!analytics) return [];

      return Object.entries(analytics.featureUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([feature, usage]) => ({ feature, usage }));
    },
    [analytics]
  );

  const getStorageUsageInMB = useCallback(() => {
    if (!analytics) return 0;
    return Math.round((analytics.totalStorageUsed / (1024 * 1024)) * 100) / 100;
  }, [analytics]);

  const getStorageUsageInGB = useCallback(() => {
    if (!analytics) return 0;
    return (
      Math.round((analytics.totalStorageUsed / (1024 * 1024 * 1024)) * 100) /
      100
    );
  }, [analytics]);

  const getFormattedStorageUsage = useCallback(() => {
    if (!analytics) return "0 B";

    const bytes = analytics.totalStorageUsed;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }, [analytics]);

  const getLastActiveDate = useCallback(() => {
    return analytics?.lastActiveDate || null;
  }, [analytics]);

  const isRecentlyActive = useCallback(
    (days: number = 7) => {
      if (!analytics?.lastActiveDate) return false;

      const lastActive = analytics.lastActiveDate.toDate();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      return lastActive > cutoff;
    },
    [analytics]
  );

  return {
    analytics,
    loading,
    error,
    trackFeature,
    getFeatureUsage,
    getTotalFeatureUsage,
    getMostUsedFeatures,
    getStorageUsageInMB,
    getStorageUsageInGB,
    getFormattedStorageUsage,
    getLastActiveDate,
    isRecentlyActive,
  };
}
