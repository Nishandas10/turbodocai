import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // always fetch fresh

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toBaseHref(u: string): string {
  try {
    const url = new URL(u);
    // Use full URL so relative links resolve correctly
    return url.toString();
  } catch {
    return "/";
  }
}

function stripUnwanted(html: string): string {
  if (!html) return "";
  let s = html;
  // Remove scripts, noscript, styles entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Drop common layout/navigation elements
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  s = s.replace(/<header[\s\S]*?<\/header>/gi, "");
  // Remove inline event handlers and scriptable attributes
  s = s.replace(/ on[a-z]+="[^"]*"/gi, "");
  s = s.replace(/ on[a-z]+='[^']*'/gi, "");
  // Remove iframes and embeds to keep it static
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/<embed[\s\S]*?<\/embed>/gi, "");
  s = s.replace(/<object[\s\S]*?<\/object>/gi, "");
  return s;
}

function extractMain(html: string): string {
  // Prefer <main>, then <article>, else <body>
  const mainMatch = html.match(/<main[\s\S]*?>[\s\S]*?<\/main>/i);
  if (mainMatch) return mainMatch[0];
  const articleMatch = html.match(/<article[\s\S]*?>[\s\S]*?<\/article>/i);
  if (articleMatch) return articleMatch[0];
  const bodyMatch = html.match(/<body[\s\S]*?>[\s\S]*?<\/body>/i);
  if (bodyMatch) {
    // unwrap body content
    const m = bodyMatch[0]
      .replace(/^<body[^>]*>/i, "")
      .replace(/<\/body>$/i, "");
    return m;
  }
  // Fallback to entire html if body not found
  const htmlMatch = html.match(/<html[\s\S]*?>[\s\S]*?<\/html>/i);
  if (htmlMatch) return htmlMatch[0];
  return html;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !isHttpUrl(url)) {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return new NextResponse(`Failed to fetch: ${res.status}`, {
        status: 502,
      });
    }
    const raw = await res.text();
    // Extract reasonable content then strip unwanted
    const main = extractMain(raw);
    const cleaned = stripUnwanted(main);

    const baseHref = toBaseHref(url);
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${baseHref}">
    <title>Webpage Preview</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
      .container { max-width: 56rem; margin: 0 auto; padding: 2rem; line-height: 1.6; }
      img, video { max-width: 100%; height: auto; }
      pre, code { white-space: pre-wrap; word-wrap: break-word; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      h1,h2,h3,h4 { line-height: 1.25; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid rgba(0,0,0,0.1); padding: 0.5rem; }
    </style>
  </head>
  <body>
    <div class="container">${cleaned}</div>
  </body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Allow embedding in our own app
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e: any) {
    return new NextResponse(`Error: ${e?.message || "unknown"}`, {
      status: 500,
    });
  }
}
