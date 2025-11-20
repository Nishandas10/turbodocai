import { getUserAnalytics, getUserProfile } from "@/lib/firestore";

/**
 * Plan/usage gate for uploads and chat creation.
 * Updated Rules (Nov 2025 change request):
 * - premium: always allowed
 * - free: show upgrade (block) when EITHER aiChatsUsed >= 3 OR documentsCreated >= 3
 *   (whichever threshold the user reaches first).
 */
export async function checkUploadAndChatPermission(userId: string): Promise<{
  allowed: boolean;
  plan: "free" | "premium" | "unknown";
  aiChatsUsed?: number;
  documentsCreated?: number;
}> {
  try {
    const [profile, analytics] = await Promise.all([
      getUserProfile(userId),
      getUserAnalytics(userId),
    ]);

    const plan = profile?.subscription ?? "unknown";

    if (plan === "premium") {
      return { allowed: true, plan };
    }

    const aiChatsUsed = analytics?.aiChatsUsed ?? 0;
    const documentsCreated = analytics?.documentsCreated ?? 0;

    // Block (trigger upgrade modal) once either threshold is reached for free users.
    const blocked =
      plan === "free" && (aiChatsUsed >= 3 || documentsCreated >= 3);

    return {
      allowed: !blocked,
      plan: plan === "unknown" ? "free" : plan,
      aiChatsUsed,
      documentsCreated,
    };
  } catch {
    // Fail-open to avoid false blocks if Firestore is temporarily unavailable
    return { allowed: true, plan: "unknown" };
  }
}
