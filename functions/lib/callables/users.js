"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUserByEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../config/firebase");
exports.resolveUserByEmail = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { email } = request.data || {};
        if (!request.auth)
            throw new Error("Authentication required");
        if (!email || typeof email !== "string")
            throw new Error("Missing email");
        const norm = String(email).toLowerCase().trim();
        const snap = await firebase_1.db.collection("users").where("email", "==", norm).limit(1).get();
        if (snap.empty)
            return { success: true, data: null };
        const d = snap.docs[0];
        const data = d.data();
        return {
            success: true,
            data: {
                userId: d.id,
                displayName: (data === null || data === void 0 ? void 0 : data.displayName) || "",
                photoURL: (data === null || data === void 0 ? void 0 : data.photoURL) || "",
            },
        };
    }
    catch (err) {
        console.error("resolveUserByEmail error", err);
        return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
});
//# sourceMappingURL=users.js.map