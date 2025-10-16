// Initialize Firebase Admin and global function options once
import "./config/firebase";

// Export modular callables
export { createChat } from "./callables/chat";
export { resolveUserByEmail } from "./callables/users";
export { sendChatMessage, queryDocuments } from "./callables/rag";
export { generateSummary } from "./callables/summaries";
export { generatePodcast } from "./callables/podcast";
export { evaluateLongAnswer } from "./callables/evaluation";

// Export modular triggers
export { processDocument } from "./triggers/documents";
export { syncAllDocuments } from "./triggers/syncAllDocuments";
export { generateMindMap } from "./triggers/mindmaps";
