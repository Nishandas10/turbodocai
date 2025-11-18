Restrict Features for Free Users

In your app logic, before upload or chat actions, check the user’s plan:

const canUpload = (user) => {
if (user.plan === "pro") return true;
if (user.uploadsToday < 3) return true;
return false;
};

Store usage in Firestore/Supabase:

{
uid: "user123",
plan: "free",
uploadsToday: 2,
chatsToday: 5,
lastReset: "2025-11-02"
}

aiChatsUsed
71

documentsCreated
20
