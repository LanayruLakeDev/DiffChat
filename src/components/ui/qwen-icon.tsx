import Image from "next/image";

interface QwenIconProps {
  className?: string;
}

export function QwenIcon({ className }: QwenIconProps) {
  return (
    <Image
      src="/icons/qwen.svg"
      alt="Qwen"
      width={16}
      height={16}
      className={className}
    />
  );
}
