import Image from "next/image";

interface NousResearchIconProps {
  className?: string;
}

export function NousResearchIcon({ className }: NousResearchIconProps) {
  return (
    <Image
      src="/icons/nousresearch.svg"
      alt="NousResearch"
      width={16}
      height={16}
      className={className}
    />
  );
}
