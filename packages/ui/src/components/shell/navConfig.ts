import { IconName } from "@/components/Icon";
import { DEFAULT_LOCALE, translate } from "@/locales";

// Single source of truth for the app's navigation. Both the chat-home
// sidebar (`app/page.tsx`, via `SidebarNav`) and the persistent rail
// (`components/shell/AppShell.tsx`) build their menus from here, so the
// two navs can never drift apart again. When adding a destination, add
// it ONCE in this file.

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /**
   * One-line plain-language explanation of the destination, surfaced as a
   * tooltip in the rail/sidebar and as card copy on the Settings hub.
   * Required so every new destination ships with an explanation.
   */
  description: string;
  /** Optional pending-count badge (e.g. items awaiting review). */
  badge?: number;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

interface BuildOpts {
  /**
   * When false, the Company-profile entry points at the onboarding
   * wizard and is relabelled "Set up company". The chat home knows the
   * onboarding state from `/health`; the rail assumes onboarded (its
   * routes are only reachable post-setup).
   */
  isOnboarded?: boolean;
  /** Pending + needs-revision count shown on the Review entry. */
  reviewBadge?: number;
  /** Language locale for nav text (defaults to DEFAULT_LOCALE for i18n support). */
  locale?: string;
}

// Day-to-day navigation only. Power/admin tools live in the Settings
// area (see ADVANCED_ITEMS) so this list stays focused.
export function buildPrimaryNav({ isOnboarded = true, reviewBadge = 0, locale = DEFAULT_LOCALE }: BuildOpts = {}): NavGroup[] {
  return [
    {
      key: "workspace",
      label: translate(locale, "nav.workspace"),
      items: [
        {
          href: "/review",
          label: translate(locale, "nav.review"),
          icon: "check-circle",
          badge: reviewBadge,
          description: translate(locale, "desc.review"),
        },
        {
          href: "/jobs",
          label: translate(locale, "nav.jobs"),
          icon: "doc",
          description: translate(locale, "desc.jobs"),
        },
        {
          href: "/artifacts",
          label: translate(locale, "nav.artifacts"),
          icon: "book",
          description: translate(locale, "desc.artifacts"),
        },
        {
          href: "/watchlist",
          label: translate(locale, "nav.watchlist"),
          icon: "eye",
          description: translate(locale, "desc.watchlist"),
        },
      ],
    },
    {
      key: "company",
      label: translate(locale, "nav.company"),
      items: [
        {
          href: "/departments",
          label: translate(locale, "nav.departments"),
          icon: "grid",
          description: translate(locale, "desc.departments"),
        },
        {
          href: "/people",
          label: translate(locale, "nav.people"),
          icon: "users",
          description: translate(locale, "desc.people"),
        },
        {
          href: "/talent",
          label: translate(locale, "nav.talent"),
          icon: "clipboard",
          description: translate(locale, "desc.talent"),
        },
        {
          href: "/staff-onboarding",
          label: translate(locale, "nav.staffOnboarding"),
          icon: "users",
          description: translate(locale, "desc.staffOnboarding"),
        },
        {
          href: isOnboarded ? "/company-profile" : "/onboard",
          label: isOnboarded
            ? translate(locale, "nav.companyProfile")
            : translate(locale, "nav.setupCompany"),
          icon: "building",
          description: translate(locale, "desc.companyProfile"),
        },
      ],
    },
    {
      key: "knowledge",
      label: translate(locale, "nav.knowledge"),
      items: [
        {
          href: "/knowledge",
          label: translate(locale, "nav.knowledge"),
          icon: "book",
          description: translate(locale, "desc.knowledge"),
        },
        {
          href: "/skills",
          label: translate(locale, "nav.skills"),
          icon: "bolt",
          description: translate(locale, "desc.skills"),
        },
      ],
    },
  ];
}

// Localized helper getters
export function getPulseNavItem(locale: string = DEFAULT_LOCALE): NavItem {
  return {
    href: "/memories",
    label: translate(locale, "nav.pulse"),
    icon: "activity",
    description: translate(locale, "desc.pulse"),
  };
}

export function getSettingsNavItem(locale: string = DEFAULT_LOCALE): NavItem {
  return {
    href: "/settings",
    label: translate(locale, "nav.settings"),
    icon: "cog",
    description: translate(locale, "desc.settings"),
  };
}

export function getGuideNavItem(locale: string = DEFAULT_LOCALE): NavItem {
  return {
    href: "/guide",
    label: translate(locale, "nav.guide"),
    icon: "info",
    description: translate(locale, "desc.guide"),
  };
}

export function getNewChatDescription(locale: string = DEFAULT_LOCALE): string {
  return translate(locale, "desc.newChat");
}

export function getBriefingDescription(locale: string = DEFAULT_LOCALE): string {
  return translate(locale, "desc.briefing");
}

export const PULSE_NAV_ITEM: NavItem = getPulseNavItem("en");
export const SETTINGS_NAV_ITEM: NavItem = getSettingsNavItem("en");
export const GUIDE_NAV_ITEM: NavItem = getGuideNavItem("en");
export const NEW_CHAT_DESCRIPTION = getNewChatDescription("en");
export const BRIEFING_DESCRIPTION = getBriefingDescription("en");

// Admin / power-user tools surfaced on the Settings hub page rather than
// in the primary nav — they aren't part of the day-to-day loop.
export function getAdvancedItems(locale: string = DEFAULT_LOCALE): NavItem[] {
  return [
    {
      href: "/council",
      label: translate(locale, "nav.council"),
      icon: "users",
      description: translate(locale, "desc.council"),
    },
    {
      href: "/audit",
      label: translate(locale, "nav.audit"),
      icon: "doc-search",
      description: translate(locale, "desc.audit"),
    },
    {
      href: "/audit/usage",
      label: translate(locale, "nav.usage"),
      icon: "activity",
      description: translate(locale, "desc.usage"),
    },
    {
      href: "/guide",
      label: translate(locale, "nav.guide"),
      icon: "info",
      description: translate(locale, "desc.guide"),
    },
    {
      href: "/architecture",
      label: translate(locale, "nav.architecture"),
      icon: "grid",
      description: translate(locale, "desc.architecture"),
    },
    {
      href: "/demo",
      label: translate(locale, "nav.demo"),
      icon: "cog",
      description: translate(locale, "desc.demo"),
    },
    {
      href: "/clients",
      label: translate(locale, "nav.clients"),
      icon: "building",
      description: translate(locale, "desc.clients"),
    },
  ];
}

export const ADVANCED_ITEMS: NavItem[] = getAdvancedItems("en");

export function getMobilePrimary(locale: string = DEFAULT_LOCALE): NavItem[] {
  return [
    {
      href: "/",
      label: translate(locale, "nav.briefing"),
      icon: "clipboard",
      description: getBriefingDescription(locale),
    },
    getPulseNavItem(locale),
    {
      href: "/?new=1",
      label: translate(locale, "nav.newChat"),
      icon: "plus",
      description: getNewChatDescription(locale),
    },
    {
      href: "/people",
      label: translate(locale, "nav.people"),
      icon: "users",
      description: translate(locale, "desc.people"),
    },
    {
      href: "/jobs",
      label: translate(locale, "nav.jobs"),
      icon: "doc",
      description: translate(locale, "desc.jobs"),
    },
  ];
}

// Anchors the mobile bottom nav. ≤5 per Material guidance; "More" opens
// the drawer with the full menu. `/` lands on the briefing surface.
export const MOBILE_PRIMARY: NavItem[] = getMobilePrimary("en");
