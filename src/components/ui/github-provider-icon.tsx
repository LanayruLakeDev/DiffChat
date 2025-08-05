import Image from "next/image";

interface GithubProviderIconProps {
  className?: string;
}

export function GithubProviderIcon({ className }: GithubProviderIconProps) {
  return (
    <Image
      src="/icons/github.svg"
      alt="GitHub"
      width={16}
      height={16}
      className={className}
    />
  );
}
