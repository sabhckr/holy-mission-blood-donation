import {
  Building2,
  Copy,
  Download,
  Flag,
  KeyRound,
  LayoutDashboard,
  MapPinned,
  Map as MapIcon,
  ScrollText,
  Settings,
  ShieldCheck,
  Siren,
  UserRoundCog,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** One icon per staff page, shared by the menu and the page headings so they always match. */
export const ADMIN_ICONS = {
  overview: LayoutDashboard,
  donors: Users,
  verifications: ShieldCheck,
  reports: Flag,
  duplicates: Copy,
  requests: Siren,
  communities: Building2,
  operatingAreas: MapPinned,
  users: UserRoundCog,
  access: KeyRound,
  locations: MapIcon,
  settings: Settings,
  audit: ScrollText,
  export: Download,
  deletions: UserX,
} satisfies Record<string, LucideIcon>;

export type AdminNavKey = keyof typeof ADMIN_ICONS;
