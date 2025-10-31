declare module "@extractus/article-extractor" {
  export function extract(
    input: string | URL,
    options?: any
  ): Promise<{
    title?: string;
    content?: string; // HTML
    text?: string; // plain text if available
    url?: string;
    author?: string;
    image?: string;
    published?: string | Date;
    ttr?: number;
  } | null>;
}
