import Image from "next/image";

interface DeepSeekIconProps {
  className?: string;
}

export function DeepSeekIcon({ className }: DeepSeekIconProps) {
  return (
    <Image
      src="/icons/deepseek.svg"
      alt="DeepSeek"
      width={16}
      height={16}
      className={className}
    />
  );
}
