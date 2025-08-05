import Image from "next/image";

interface MistralIconProps {
  className?: string;
}

export function MistralIcon({ className }: MistralIconProps) {
  return (
    <Image
      src="/icons/mistral.svg"
      alt="Mistral"
      width={16}
      height={16}
      className={className}
    />
  );
}
