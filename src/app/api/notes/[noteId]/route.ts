/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getDocument, updateDocument } from "@/lib/firestore";
import { uploadDocument } from "@/lib/storage";

export async function GET(request: Request, context: any) {
  try {
    const { noteId } = context?.params || {};
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const document = await getDocument(noteId, userId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: any) {
  try {
    const { noteId } = context?.params || {};
    const body = await request.json();
    const { content, title, userId, lexicalState } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Update document content and metadata
    const updateData = {
      title,
      content: {
        raw: "", // Content is in localStorage and Firebase Storage, not here
        processed: "", // Content is in localStorage and Firebase Storage, not here
        // Don't save lexicalState to Firestore - it's in localStorage
      },
      metadata: {
        fileName: `${title}.txt`,
        fileSize: new Blob([content]).size,
        mimeType: "text/plain",
      },
    };

    await updateDocument(noteId, userId, updateData);

    // Update the .txt file in Firebase Storage
    if (content !== undefined) {
      const txtFile = new File([content], `${title}.txt`, {
        type: "text/plain",
      });
      const uploadResult = await uploadDocument(txtFile, userId, noteId);

      if (!uploadResult.success) {
        console.warn("Failed to update storage file:", uploadResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Document updated successfully",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
