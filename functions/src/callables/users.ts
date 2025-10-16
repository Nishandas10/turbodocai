import { onCall } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

export const resolveUserByEmail = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { email } = request.data || {};
      if (!request.auth) throw new Error("Authentication required");
      if (!email || typeof email !== "string") throw new Error("Missing email");
      const norm = String(email).toLowerCase().trim();
      const snap = await db
        .collection("users")
        .where("email", "==", norm)
        .limit(1)
        .get();
      if (snap.empty) return { success: true, data: null };
      const d = snap.docs[0];
      const data = d.data() as any;
      return {
        success: true,
        data: {
          userId: d.id,
          displayName: data?.displayName || "",
          photoURL: data?.photoURL || "",
        },
      };
    } catch (err) {
      console.error("resolveUserByEmail error", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
);
