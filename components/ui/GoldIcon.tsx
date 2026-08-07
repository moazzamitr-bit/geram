import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  ChartLine,
  Lock,
  Package,
  Shield,
  Target,
  Vault,
  Zap,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  shield: Shield,
  vault: Vault,
  badge: BadgeCheck,
  target: Target,
  package: Package,
  zap: Zap,
  lock: Lock,
  chart: ChartLine,
};

type GoldIconProps = {
  name: keyof typeof iconMap | string;
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export function GoldIcon({
  name,
  className,
  size = 22,
  strokeWidth = 1.5,
}: GoldIconProps) {
  const Icon = iconMap[name] ?? Shield;

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={cn("text-gold shrink-0", className)}
      aria-hidden
    />
  );
}
