import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// EDGE RUNTIME: Critical for speed
export const runtime = "edge";

const PROMPT_REFINEMENT_SYSTEM = `You are an expert at creating concise, realistic image generation prompts.
Given a course title or topic, create a image prompt that would generate an appealing, realistic image proper for a course thumbnail.

Focus on:
- Visual metaphors and symbols related to the topic
- Professional, modern aesthetic
- Clean, minimalist design
- Realistic style
- Warm, inviting colors

Keep it under 100 words. Output ONLY the refined prompt, nothing else.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt: string };
    const userPrompt = body.prompt?.trim();

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing 'prompt' in request body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Step 1: Refine the prompt using Gemini Flash Lite
    const refinedPromptResult = await generateText({
      model: google("gemini-2.0-flash-lite"),
      system: PROMPT_REFINEMENT_SYSTEM,
      prompt: `Course topic: ${userPrompt}\n\nCreate an image generation prompt for this course thumbnail.`,
    });

    const refinedPrompt = refinedPromptResult.text.trim();

    // Step 2: Generate image using Imagen 4.0
    const imageModel = google.image("imagen-4.0-fast-generate-001");
    const { images } = await imageModel.doGenerate({
      prompt: refinedPrompt,
      n: 1,
      size: "1024x1024",
      aspectRatio: "1:1",
      seed: undefined,
      providerOptions: {},
    });

    if (!images || images.length === 0) {
      throw new Error("Failed to generate image");
    }

    // Convert Uint8Array to base64 if needed
    const imageData =
      typeof images[0] === "string"
        ? images[0]
        : Buffer.from(images[0]).toString("base64");

    // Return the base64 image data
    return new Response(
      JSON.stringify({
        success: true,
        image: imageData,
        refinedPrompt,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Image generation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
