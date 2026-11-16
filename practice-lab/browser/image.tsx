export default function Image({ src, priority, fill, unoptimized, quality, loader, ...props }: any) {
  const path = typeof src === 'string' ? src : src.src;
  return <img {...props} src={(window as any).__practiceAssets[path] ?? path} />;
}
