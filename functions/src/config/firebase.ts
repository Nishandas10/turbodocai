import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin once per module load
export const app = initializeApp();
export const db = getFirestore(app);
export const storage = getStorage();

// Set global options
setGlobalOptions({
  maxInstances: 5,
  concurrency: 1,
  region: "us-central1",
  memory: "4GiB",
  timeoutSeconds: 540,
});
