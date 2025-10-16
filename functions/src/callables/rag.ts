import { onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { db } from "../config/firebase";
import { QueryService } from "../services/queryService";
import { EmbeddingService } from "../services/embeddingService";
import { PineconeService } from "../services/pineconeService";

export const sendChatMessage = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { userId, prompt, language, chatId, docIds, webSearch, thinkMode } =
        request.data || {};
      if (!userId || !prompt || typeof prompt !== "string")
        throw new Error("Missing required parameters: userId and prompt");
      if (request.auth && request.auth.uid && request.auth.uid !== userId)
        throw new Error("Authenticated user mismatch");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = webSearch
        ? "gpt-4.1"
        : thinkMode
        ? "o3-mini"
        : "gpt-4o-mini";

      // Create or fetch chat document
      let chatDocId: string = chatId;
      if (!chatDocId) {
        const title = (prompt as string).trim().slice(0, 60);
        const chatRef = await db.collection("chats").add({
          userId,
          title: title || "New Chat",
          language: language || "en",
          model,
          contextDocIds: Array.isArray(docIds) ? docIds.slice(0, 8) : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        chatDocId = chatRef.id;
      } else {
        await db
          .collection("chats")
          .doc(chatDocId)
          .set(
            {
              updatedAt: new Date(),
              language: language || "en",
              model,
              ...(Array.isArray(docIds) && docIds.length
                ? { contextDocIds: docIds.slice(0, 8) }
                : {}),
            },
            { merge: true }
          );
      }

      const messagesCol = db
        .collection("chats")
        .doc(chatDocId)
        .collection("messages");

      // Add user's message if not already last
      try {
        const lastSnap = await messagesCol
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
        const last = (lastSnap.docs[0]?.data() as any) || undefined;
        const sameContent = last && String(last.content) === String(prompt);
        const isUser = last && last.role === "user";
        if (!(sameContent && isUser)) {
          await messagesCol.add({
            role: "user",
            content: String(prompt),
            createdAt: new Date(),
          });
        }
      } catch (dupeErr) {
        console.warn("User message duplicate check failed", dupeErr);
      }

      // Load last messages for context
      const recentSnap = await messagesCol
        .orderBy("createdAt", "asc")
        .limit(20)
        .get();
      const convo = recentSnap.docs.map((d) => d.data() as any);

      // Active context documents
      let activeDocIds: string[] = [];
      try {
        if (Array.isArray(docIds) && docIds.length) {
          activeDocIds = docIds.slice(0, 8);
        } else {
          const chatSnap = await db.collection("chats").doc(chatDocId).get();
          const data = chatSnap.data() as any;
          if (Array.isArray(data?.contextDocIds))
            activeDocIds = data.contextDocIds.slice(0, 8);
        }
      } catch (e) {
        console.warn("Could not load contextDocIds", e);
      }

      // Optional RAG retrieval using services
      let docsContext = "";
      if (activeDocIds.length) {
        try {
          const embeddingService = new EmbeddingService();
          const pineconeService = new PineconeService();
          const queryEmbedding = await embeddingService.embedQuery(
            String(prompt)
          );
          const perDoc = 3;
          const aggregated: Array<{
            docId: string;
            title: string;
            chunk: string;
            score: number;
          }> = [];
          for (const dId of activeDocIds) {
            try {
              const matches = await pineconeService.querySimilarChunks(
                queryEmbedding,
                userId,
                perDoc * 2,
                dId
              );
              const seen = new Set<string>();
              for (const m of matches) {
                const idx = String(m.id).split("_").pop() || String(m.id);
                if (seen.has(idx)) continue;
                seen.add(idx);
                aggregated.push({
                  docId: dId,
                  title: m.title || dId,
                  chunk: m.chunk,
                  score: m.score,
                });
                if (seen.size >= perDoc) break;
              }
            } catch (inner) {
              console.warn("RAG doc retrieval failed", { docId: dId, inner });
            }
          }
          aggregated.sort((a, b) => b.score - a.score);
          const MAX_CONTEXT_CHARS = 12000;
          const pieces: string[] = [];
          let used = 0;
          for (const a of aggregated) {
            const clean = a.chunk.replace(/\s+/g, " ").trim();
            if (!clean) continue;
            const snippet = clean.slice(0, 1000);
            const block = `DOC ${a.docId} | ${a.title}\n${snippet}`;
            if (used + block.length > MAX_CONTEXT_CHARS) break;
            pieces.push(block);
            used += block.length;
          }
          if (pieces.length) {
            docsContext = `Retrieved document context (do not fabricate beyond this unless using general knowledge cautiously):\n\n${pieces.join(
              "\n\n---\n\n"
            )}`;
          }
        } catch (ragErr) {
          console.warn(
            "RAG retrieval failed, falling back to no docsContext",
            ragErr
          );
        }
      }

      let baseInstruction =
        "You are a helpful AI assistant. Prefer grounded answers using provided document context blocks when present. If context insufficient, say so and optionally ask for more info. Keep responses concise and clear. Use markdown when helpful.";
      if (webSearch) {
        baseInstruction +=
          "\n\nWeb browsing is permitted via the web_search tool. Use it when the question requires up-to-date or external information. Summarize findings and cite source domains briefly (e.g., example.com).";
      }
      const sysContent = docsContext
        ? `${baseInstruction}\n\n${docsContext}`
        : baseInstruction;
      const sysMsg = { role: "system" as const, content: sysContent };
      const chatMessages = [
        sysMsg,
        ...convo.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      // Assistant placeholder
      const assistantRef = await messagesCol.add({
        role: "assistant",
        content: "",
        createdAt: new Date(),
        streaming: true,
      });
      let buffered = "";
      let lastUpdate = Date.now();
      const flush = async (final = false) => {
        try {
          await assistantRef.set(
            {
              content: buffered,
              streaming: final ? false : true,
              updatedAt: new Date(),
            },
            { merge: true }
          );
          await db
            .collection("chats")
            .doc(chatDocId)
            .set({ updatedAt: new Date() }, { merge: true });
        } catch (e) {
          console.warn("Failed to flush streaming token to Firestore", e);
        }
      };

      const streamOut = async (fullText: string) => {
        try {
          const chunkSize = 48;
          const delayMs = 24;
          buffered = "";
          for (let i = 0; i < fullText.length; i += chunkSize) {
            buffered += fullText.slice(i, i + chunkSize);
            await flush(false);
            await new Promise((r) => setTimeout(r, delayMs));
          }
          await flush(true);
        } catch (e) {
          console.warn("streamOut failed; falling back to single flush", e);
          buffered = fullText;
          await flush(true);
        }
      };

      try {
        if (webSearch) {
          // Non-streaming Responses API with web_search tool (gpt-4.1)
          const input = chatMessages.map((m) => ({
            role: (m as any).role,
            content: [
              {
                type:
                  (m as any).role === "assistant"
                    ? "output_text"
                    : "input_text",
                text: String((m as any).content || ""),
              },
            ],
          }));
          const resp: any = await (openai as any).responses.create({
            model,
            input,
            tools: [{ type: "web_search" }],
          });
          const fullText =
            resp?.output_text ||
            resp?.output?.[0]?.content?.[0]?.text ||
            resp?.data?.[0]?.content?.[0]?.text ||
            resp?.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await streamOut(String(fullText));
        } else if (thinkMode) {
          const input = chatMessages.map((m) => ({
            role: (m as any).role,
            content: [
              {
                type:
                  (m as any).role === "assistant"
                    ? "output_text"
                    : "input_text",
                text: String((m as any).content || ""),
              },
            ],
          }));
          const resp: any = await (openai as any).responses.create({
            model,
            input,
          });
          const fullText =
            resp?.output_text ||
            resp?.output?.[0]?.content?.[0]?.text ||
            resp?.data?.[0]?.content?.[0]?.text ||
            resp?.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await streamOut(String(fullText));
        } else {
          const stream = await openai.chat.completions.create({
            model,
            temperature: thinkMode ? 0.2 : 0.7,
            messages: chatMessages as any,
            stream: true,
          } as any);
          for await (const part of stream as any) {
            const delta = part?.choices?.[0]?.delta?.content || "";
            if (delta) buffered += delta;
            const now = Date.now();
            if (now - lastUpdate > 250) {
              await flush(false);
              lastUpdate = now;
            }
          }
          await flush(true);
        }
      } catch (genErr) {
        console.error("OpenAI generation failed", genErr);
        try {
          const fallbackModel =
            webSearch || (typeof model === "string" && model.startsWith("o3"))
              ? "gpt-4o-mini"
              : model;
          const completion = await openai.chat.completions.create({
            model: fallbackModel as any,
            temperature: thinkMode ? 0.2 : 0.7,
            messages: chatMessages as any,
          } as any);
          buffered =
            completion.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await flush(true);
        } catch (fallbackErr) {
          console.error("OpenAI fallback also failed", fallbackErr);
          buffered = "I'm sorry, an error occurred generating the response.";
          await flush(true);
        }
      }

      if (!chatId) {
        const title = (prompt as string).trim().slice(0, 60);
        await db
          .collection("chats")
          .doc(chatDocId)
          .set({ title: title || "New Chat" }, { merge: true });
      }

      return { success: true, data: { chatId: chatDocId } };
    } catch (error) {
      console.error("Error in sendChatMessage:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

export const queryDocuments = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { question, userId, documentId, topK } = request.data;
      if (!question || !userId)
        throw new Error("Missing required parameters: question and userId");
      const queryService = new QueryService();
      const result = await queryService.queryRAG(
        question,
        userId,
        documentId,
        topK || 5
      );
      return { success: true, data: result };
    } catch (error) {
      console.error("Error in queryDocuments:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
