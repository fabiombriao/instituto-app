import {
  Award,
  DollarSign,
  Flame,
  MessageSquare,
  Shield,
  Target,
  TrendingUp,
  TreePine,
  Zap,
} from 'lucide-react';

export const BADGE_ICONS = {
  Award,
  DollarSign,
  Flame,
  MessageSquare,
  Shield,
  Target,
  TrendingUp,
  TreePine,
  Zap,
} as const;

export type BadgeIconName = keyof typeof BADGE_ICONS;

export function getBadgeIcon(iconName?: string | null) {
  if (iconName && iconName in BADGE_ICONS) {
    return BADGE_ICONS[iconName as BadgeIconName];
  }

  return Award;
}
