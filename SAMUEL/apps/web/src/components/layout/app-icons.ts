import type { LucideIcon } from 'lucide-react';
import {
  Building,
  Building2,
  Calendar,
  ClipboardList,
  Fuel,
  House,
  Landmark,
  Map,
  Navigation,
  Route,
  Truck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  '/': House,
  '/map': Map,
  '/agenda': Calendar,
  '/services': ClipboardList,
  '/routes': Route,
  '/field/my-route': Navigation,
  '/customers': Building2,
  '/employees': Users,
  '/vehicles': Truck,
  '/fuel': Fuel,
  '/costs': Wallet,
  '/settings/companies': Building,
  '/settings/company': Landmark,
  '/settings/users': UserCog,
};
