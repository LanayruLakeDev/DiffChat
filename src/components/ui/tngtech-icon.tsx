import Image from "next/image";

interface TngTechIconProps {
  className?: string;
}

export function TngTechIcon({ className }: TngTechIconProps) {
  return (
    <Image
      src="/icons/tngtech.svg"
      alt="TNG Technology"
      width={16}
      height={16}
      className={className}
    />
  );
}
