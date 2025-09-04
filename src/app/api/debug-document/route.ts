import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const { documentId, userId, action } = await request.json();

    if (!documentId || !userId) {
      return NextResponse.json(
        { error: "Missing documentId or userId" },
        { status: 400 }
      );
    }

    const docRef = doc(db, "documents", userId, "userDocuments", documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data();

    if (action === "reset") {
      // Reset stuck processing status
      await updateDoc(docRef, {
        processingStatus: "completed",
        processingProgress: 100,
        processingCompletedAt: new Date(),
      });

      return NextResponse.json({
        message: "Document status reset to completed",
        oldStatus: data.processingStatus,
        newStatus: "completed",
      });
    }

    // Default: just return current status
    return NextResponse.json({
      documentId,
      status: data.processingStatus || data.status || "unknown",
      progress: data.processingProgress,
      chunkCount: data.chunkCount,
      characterCount: data.characterCount,
      metadata: data.metadata,
    });
  } catch (error) {
    console.error("Debug document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
