import { NextResponse } from "next/server";

export const runtime = "edge";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function isLikelyImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (!ext) return false;
    return ALLOWED_IMAGE_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("term");

  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });

  try {
    // Search in File: namespace but strictly filter to images.
    // Commons file namespace includes PDFs, audio, video, etc.
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|mediatype|extmetadata&iiurlwidth=1280&format=json&origin=*`;

    const res = await fetch(searchUrl);
    const data = await res.json();

    const pages = data?.query?.pages;
    if (!pages) return NextResponse.json({ url: null });

    // Pick the first entry that looks like a real image.
    for (const pageId of Object.keys(pages)) {
      const ii = pages?.[pageId]?.imageinfo?.[0];
      if (!ii) continue;

      // Prefer thumbnail url (more stable sizes + usually bitmap), then original.
      const candidateUrl: string | null =
        (typeof ii.thumburl === "string" && ii.thumburl) ||
        (typeof ii.url === "string" && ii.url) ||
        null;
      if (!candidateUrl) continue;

      const mediatype = typeof ii.mediatype === "string" ? ii.mediatype : "";
      const mime = typeof ii.mime === "string" ? ii.mime : "";

      // Wikimedia: mediatype can be BITMAP / DRAWING / AUDIO / VIDEO / MULTIMEDIA / OFFICE
      // Accept BITMAP + DRAWING only if mime is image/* and extension is safe (skip svg/pdfs/etc).
      const isImageMime = mime.toLowerCase().startsWith("image/");
      const isAllowedMediaType =
        mediatype === "BITMAP" || mediatype === "DRAWING";

      if (!isAllowedMediaType || !isImageMime) continue;
      if (!isLikelyImageUrl(candidateUrl)) continue;

      return NextResponse.json({ url: candidateUrl });
    }

    return NextResponse.json({ url: null });
  } catch (error) {
    console.error("Wiki Fetch Error:", error);
    return NextResponse.json({ url: null });
  }
}
