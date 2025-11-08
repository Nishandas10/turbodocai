"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";

type Props = {
  host?: string;
  size?: number; // pixel size for width/height
  className?: string; // tailwind classes for sizing/shape
};

export default function Favicon({ host, size = 28, className }: Props) {
  const [errored, setErrored] = useState(false);
  const defaultSizeCls = "h-7 w-7";
  if (!host || errored) {
    return <Globe className={className || `${defaultSizeCls} text-muted-foreground`} />;
  }
  const src = `https://www.google.com/s2/favicons?sz=${Math.max(16, Math.min(128, size))}&domain=${host}`;
  return (
    <Image
      src={src}
      alt={host}
      width={size}
      height={size}
      className={className || `${defaultSizeCls} rounded`}
      unoptimized
      onError={() => setErrored(true)}
    />
  );
}
