"use client";
import React, { useEffect, useRef } from "react";

// JotForm embed with cleanup to prevent persistence after route change
const FORM_SCRIPT_SRC = "https://form.jotform.com/jsform/253191000499454";

export default function ContactFormEmbed() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Avoid duplicate injection
    if (container.querySelector("iframe[src*='jotform.com']")) return;

    const script = document.createElement("script");
    script.src = FORM_SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    container.appendChild(script);

    return () => {
      // Remove any JotForm iframes added to the DOM
      const iframes = document.querySelectorAll("iframe[src*='jotform.com']");
      iframes.forEach((iframe) => iframe.parentElement?.removeChild(iframe));
      // Remove injected script if still present
      if (script.parentElement) script.parentElement.removeChild(script);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="contact-form-embed"
      aria-label="Contact form"
    />
  );
}
