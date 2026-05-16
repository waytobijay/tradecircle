/**
 * components/ui/SkeletonLoader.tsx
 * Animated shimmer skeleton for loading states.
 * Spec ref: section 9.6 (Skeleton loaders)
 *
 * Variants:
 *  - text     → short line (height 14px, border-radius 4px)
 *  - card     → rectangular block (border-radius 12px)
 *  - avatar   → circular (width = height)
 *  - image    → square/rectangle image placeholder (border-radius 8px)
 *  - (default) → fully custom via width/height/borderRadius props
 */

'use client';

export type SkeletonVariant = 'text' | 'card' | 'avatar' | 'image';

export interface SkeletonLoaderProps {
  variant?:      SkeletonVariant;
  width?:        number | string;
  height?:       number | string;
  borderRadius?: number | string;
  className?:    string;
  style?:        React.CSSProperties;
}

const variantDefaults: Record<SkeletonVariant, Partial<SkeletonLoaderProps>> = {
  text:   { height: 14,  borderRadius: 4  },
  card:   { height: 180, borderRadius: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%' },
  image:  { height: 200, borderRadius: 8  },
};

export function SkeletonLoader({
  variant,
  width,
  height,
  borderRadius,
  className,
  style,
}: SkeletonLoaderProps) {
  const defaults = variant ? variantDefaults[variant] : {};

  const resolvedWidth        = width        ?? defaults.width        ?? '100%';
  const resolvedHeight       = height       ?? defaults.height       ?? 16;
  const resolvedBorderRadius = borderRadius ?? defaults.borderRadius ?? 8;

  // Avatar: enforce equal width/height for circle
  const finalWidth  = variant === 'avatar' ? resolvedHeight : resolvedWidth;
  const finalHeight = resolvedHeight;

  return (
    <>
      <div
        className={`tc-skeleton${className ? ` ${className}` : ''}`}
        style={{
          width:        finalWidth,
          height:       finalHeight,
          borderRadius: resolvedBorderRadius,
          flexShrink:   0,
          ...style,
        }}
      />
      <style>{`
        .tc-skeleton {
          background: linear-gradient(
            90deg,
            var(--color-bg-tertiary, #f1f5f9)         0%,
            color-mix(in srgb, var(--color-bg-tertiary, #f1f5f9) 70%, var(--color-text, #0f172a)) 50%,
            var(--color-bg-tertiary, #f1f5f9)         100%
          );
          background-size: 200% 100%;
          animation: sk-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes sk-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function SkeletonText(props: Omit<SkeletonLoaderProps, 'variant'>) {
  return <SkeletonLoader variant="text" {...props} />;
}

export function SkeletonCard(props: Omit<SkeletonLoaderProps, 'variant'>) {
  return <SkeletonLoader variant="card" {...props} />;
}

export function SkeletonAvatar(props: Omit<SkeletonLoaderProps, 'variant'>) {
  return <SkeletonLoader variant="avatar" {...props} />;
}

export function SkeletonImage(props: Omit<SkeletonLoaderProps, 'variant'>) {
  return <SkeletonLoader variant="image" {...props} />;
}

export default SkeletonLoader;
