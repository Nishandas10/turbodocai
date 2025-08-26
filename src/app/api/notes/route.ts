import { NextRequest, NextResponse } from "next/server";
import { createDocument } from "@/lib/firestore";
import { uploadDocument } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    // Check Firebase configuration
    console.log("Firebase config check:", {
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

    const body = await request.json();
    const { title = "Untitled Document", content = "", userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Create document data for Firestore
    const documentData = {
      title,
      type: "text" as const,
      content: {
        raw: content,
        processed: content,
      },
      metadata: {
        fileName: `${title}.txt`,
        fileSize: new Blob([content]).size,
        mimeType: "text/plain",
      },
      tags: ["blank-document"],
      isPublic: false,
    };

    // Create document in Firestore first
    console.log("Creating document in Firestore...");
    const documentId = await createDocument(userId, documentData);
    console.log("Document created in Firestore with ID:", documentId);

    // Create a .txt file and upload to Firebase Storage
    console.log("Uploading document to Firebase Storage...");
    const txtFile = new File([content], `${title}.txt`, { type: "text/plain" });
    const uploadResult = await uploadDocument(txtFile, userId, documentId);
    console.log("Upload result:", uploadResult);

    if (!uploadResult.success) {
      throw new Error(
        uploadResult.error || "Failed to upload document to storage"
      );
    }

    // Update document with storage information
    console.log("Updating document with storage info...");
    const { updateDocumentStorageInfo } = await import("@/lib/firestore");
    await updateDocumentStorageInfo(
      documentId,
      userId,
      uploadResult.storagePath!,
      uploadResult.downloadURL!
    );
    console.log("Document storage info updated successfully");

    return NextResponse.json(
      {
        id: documentId,
        title,
        content,
        type: "text",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating note:", error);

    // Provide more specific error information
    let errorMessage = "Failed to create note";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
