import {
  BedDouble,
  Briefcase,
  HardHat,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const ARCHETYPE_ICON: Record<string, LucideIcon> = {
  food_bev: UtensilsCrossed,
  field_services: Wrench,
  construction: HardHat,
  retail: Store,
  ecommerce: ShoppingBag,
  appointments: Scissors,
  clinics: Stethoscope,
  lodging: BedDouble,
  professional: Briefcase,
};
