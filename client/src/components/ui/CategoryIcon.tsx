import {
  ShoppingCart, UtensilsCrossed, Fuel, Smartphone, Shirt, Hospital, BookOpen,
  Clapperboard, Bus, Shield, Home, RefreshCw, Package, Coins, Briefcase,
  TrendingUp, Music, Plane, Dumbbell, PawPrint, Baby, Laptop, Gift,
  // Using Brush for cleaning since no broom icon
  Paintbrush, Pill, Wrench, Car, Coffee, Gamepad2, FileText,
  type LucideIcon,
} from 'lucide-react';

// Map icon name strings (stored in DB) to Lucide icon components
const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart,
  UtensilsCrossed,
  Fuel,
  Smartphone,
  Shirt,
  Hospital,
  BookOpen,
  Clapperboard,
  Bus,
  Shield,
  Home,
  RefreshCw,
  Package,
  Coins,
  Briefcase,
  TrendingUp,
  Music,
  Plane,
  Dumbbell,
  PawPrint,
  Baby,
  Laptop,
  Gift,
  Paintbrush,
  Pill,
  Wrench,
  Car,
  Coffee,
  Gamepad2,
  FileText,
};

// Ordered list for the icon picker in CategoriesPage
export const PRESET_ICON_NAMES = [
  'ShoppingCart', 'UtensilsCrossed', 'Fuel', 'Smartphone', 'Shirt', 'Hospital',
  'BookOpen', 'Clapperboard', 'Bus', 'Shield', 'Home', 'RefreshCw', 'Package',
  'Coins', 'Briefcase', 'TrendingUp', 'Music', 'Plane', 'Dumbbell', 'PawPrint',
  'Baby', 'Laptop', 'Gift', 'Paintbrush', 'Pill', 'Wrench', 'Car', 'Coffee',
  'Gamepad2', 'FileText',
];

// Migration map: old emoji → new Lucide icon name
export const EMOJI_TO_ICON: Record<string, string> = {
  '🛒': 'ShoppingCart',
  '🍽️': 'UtensilsCrossed',
  '⛽': 'Fuel',
  '📱': 'Smartphone',
  '👕': 'Shirt',
  '🏥': 'Hospital',
  '📚': 'BookOpen',
  '🎬': 'Clapperboard',
  '🚌': 'Bus',
  '🛡️': 'Shield',
  '🏠': 'Home',
  '🔄': 'RefreshCw',
  '📦': 'Package',
  '💰': 'Coins',
  '💼': 'Briefcase',
  '📈': 'TrendingUp',
  '🎵': 'Music',
  '✈️': 'Plane',
  '🏋️': 'Dumbbell',
  '🐾': 'PawPrint',
  '👶': 'Baby',
  '💻': 'Laptop',
  '🎁': 'Gift',
  '🧹': 'Paintbrush',
  '💊': 'Pill',
  '🔧': 'Wrench',
  '🚗': 'Car',
  '☕': 'Coffee',
  '🎮': 'Gamepad2',
  '📝': 'FileText',
};

interface CategoryIconProps {
  icon: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}

/**
 * Renders a Lucide icon for a category.
 * Supports both new icon names ("ShoppingCart") and legacy emojis ("🛒").
 * Falls back to Package icon.
 */
export default function CategoryIcon({ icon, className = 'w-4 h-4', strokeWidth = 1.5 }: CategoryIconProps) {
  if (!icon) {
    const Fallback = ICON_MAP.Package;
    return <Fallback className={className} strokeWidth={strokeWidth} />;
  }

  // Check if it's a Lucide icon name
  const LucideComp = ICON_MAP[icon];
  if (LucideComp) {
    return <LucideComp className={className} strokeWidth={strokeWidth} />;
  }

  // Check if it's a legacy emoji — map to Lucide
  const mappedName = EMOJI_TO_ICON[icon];
  if (mappedName) {
    const MappedComp = ICON_MAP[mappedName];
    if (MappedComp) {
      return <MappedComp className={className} strokeWidth={strokeWidth} />;
    }
  }

  // Unknown icon — render as text fallback (shouldn't happen)
  return <span className={className}>{icon}</span>;
}

/**
 * Get a Lucide icon component by name (for use in selects/options where we can't render components)
 */
export function getIconComponent(icon: string | null | undefined): LucideIcon {
  if (!icon) return ICON_MAP.Package;
  return ICON_MAP[icon] || ICON_MAP[EMOJI_TO_ICON[icon] || ''] || ICON_MAP.Package;
}
