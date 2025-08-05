import { cn } from "@/lib/utils";

interface SvgIconProps {
  src: string;
  alt: string;
  className?: string;
}

export function SvgIcon({ src, alt, className }: SvgIconProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("inline-block object-contain", className)}
      style={{ 
        filter: "brightness(0) saturate(100%) invert(var(--icon-invert, 0))",
      }}
    />
  );
}
