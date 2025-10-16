"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMindMap = exports.syncAllDocuments = exports.processDocument = exports.evaluateLongAnswer = exports.generatePodcast = exports.generateSummary = exports.queryDocuments = exports.sendChatMessage = exports.resolveUserByEmail = exports.createChat = void 0;
// Initialize Firebase Admin and global function options once
require("./config/firebase");
// Export modular callables
var chat_1 = require("./callables/chat");
Object.defineProperty(exports, "createChat", { enumerable: true, get: function () { return chat_1.createChat; } });
var users_1 = require("./callables/users");
Object.defineProperty(exports, "resolveUserByEmail", { enumerable: true, get: function () { return users_1.resolveUserByEmail; } });
var rag_1 = require("./callables/rag");
Object.defineProperty(exports, "sendChatMessage", { enumerable: true, get: function () { return rag_1.sendChatMessage; } });
Object.defineProperty(exports, "queryDocuments", { enumerable: true, get: function () { return rag_1.queryDocuments; } });
var summaries_1 = require("./callables/summaries");
Object.defineProperty(exports, "generateSummary", { enumerable: true, get: function () { return summaries_1.generateSummary; } });
var podcast_1 = require("./callables/podcast");
Object.defineProperty(exports, "generatePodcast", { enumerable: true, get: function () { return podcast_1.generatePodcast; } });
var evaluation_1 = require("./callables/evaluation");
Object.defineProperty(exports, "evaluateLongAnswer", { enumerable: true, get: function () { return evaluation_1.evaluateLongAnswer; } });
// Export modular triggers
var documents_1 = require("./triggers/documents");
Object.defineProperty(exports, "processDocument", { enumerable: true, get: function () { return documents_1.processDocument; } });
var syncAllDocuments_1 = require("./triggers/syncAllDocuments");
Object.defineProperty(exports, "syncAllDocuments", { enumerable: true, get: function () { return syncAllDocuments_1.syncAllDocuments; } });
var mindmaps_1 = require("./triggers/mindmaps");
Object.defineProperty(exports, "generateMindMap", { enumerable: true, get: function () { return mindmaps_1.generateMindMap; } });
//# sourceMappingURL=index.js.map