import Image from "next/image";

interface MetaIconProps {
  className?: string;
}

export function MetaIcon({ className }: MetaIconProps) {
  return (
    <Image
      src="/icons/meta.svg"
      alt="Meta"
      width={16}
      height={16}
      className={className}
    />
  );
}
