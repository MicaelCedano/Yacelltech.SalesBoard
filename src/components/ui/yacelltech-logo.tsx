import Image from "next/image";
import { cn } from "@/lib/utils";

/** Primer logo original del PDF de marca, conservado en formato vectorial. */
export function YacellTechLogo({ className }: { className?: string }) {
  return (
    <div className={cn("yacelltech-logo", className)}>
      <Image src="/logo-yacelltech.svg" alt="YacellTech" width={690} height={227} priority unoptimized />
    </div>
  );
}
