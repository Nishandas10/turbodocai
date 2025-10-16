"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = exports.app = void 0;
const v2_1 = require("firebase-functions/v2");
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const firestore_1 = require("firebase-admin/firestore");
// Initialize Firebase Admin once per module load
exports.app = (0, app_1.initializeApp)();
exports.db = (0, firestore_1.getFirestore)(exports.app);
exports.storage = (0, storage_1.getStorage)();
// Set global options
(0, v2_1.setGlobalOptions)({
    maxInstances: 5,
    concurrency: 1,
    region: "us-central1",
    memory: "4GiB",
    timeoutSeconds: 540,
});
//# sourceMappingURL=firebase.js.map