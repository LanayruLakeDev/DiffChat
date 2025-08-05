import Image from "next/image";

interface SophosympatheiIconProps {
  className?: string;
}

export function SophosympatheiIcon({ className }: SophosympatheiIconProps) {
  return (
    <Image
      src="/icons/sophosympatheia.svg"
      alt="Sophosympatheia"
      width={16}
      height={16}
      className={className}
    />
  );
}
