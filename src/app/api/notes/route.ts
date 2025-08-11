import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title = "Untitled Document",
      content = "",
      type = "document",
    } = body;

    // Generate a unique ID (in a real app, this would be from a database)
    const id = Date.now().toString();

    // Create the note object
    const note = {
      id,
      title,
      content,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In a real app, you would save this to a database
    // For now, we'll just return the created note

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
