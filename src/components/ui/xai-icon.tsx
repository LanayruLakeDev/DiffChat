import Image from "next/image";

interface XAIIconProps {
  className?: string;
}

export function XAIIcon({ className }: XAIIconProps) {
  return (
    <Image
      src="/icons/x-ai.svg"
      alt="X.AI"
      width={16}
      height={16}
      className={className}
    />
  );
}
