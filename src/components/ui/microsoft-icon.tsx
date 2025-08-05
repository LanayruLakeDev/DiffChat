import Image from "next/image";

interface MicrosoftIconProps {
  className?: string;
}

export function MicrosoftIcon({ className }: MicrosoftIconProps) {
  return (
    <Image
      src="/icons/microsoft.svg"
      alt="Microsoft"
      width={16}
      height={16}
      className={className}
    />
  );
}
