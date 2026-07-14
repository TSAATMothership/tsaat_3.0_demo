import type { ImgHTMLAttributes } from "react";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string };
  priority?: boolean;
  quality?: number;
};

export default function Image({ src, priority: _priority, quality: _quality, ...props }: ImageProps) {
  const rawSource = typeof src === "string" ? src : src.src;
  const resolvedSource = globalThis.__TSAAT_ASSETS__?.[rawSource] ?? rawSource;
  return <img {...props} src={resolvedSource} />;
}
