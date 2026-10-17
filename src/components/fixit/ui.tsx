import { motion, type HTMLMotionProps } from "framer-motion";
import { Car, Droplets, Fan, ShieldCheck, Wrench, Zap, Info } from "lucide-react";
import type { MachineId } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const machineIcons: Record<MachineId, typeof Zap> = {
  generator: Zap,
  pump: Droplets,
  car: Car,
  fan: Fan,
  other: Wrench,
};

type Variant = "primary" | "dark" | "outline" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground",
  dark: "bg-secondary text-secondary-foreground",
  outline: "border border-border bg-card text-foreground",
  ghost: "text-foreground",
};

export function Btn({ variant = "primary", className, ...p }: HTMLMotionProps<"button"> & { variant?: Variant }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...p}
    />
  );
}

export function TrustChip({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
      <ShieldCheck className="size-3" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <Info className="size-3" /> General guidance
    </span>
  );
}

export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.25, ease: "easeOut" as const } }),
};
