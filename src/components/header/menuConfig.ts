export const MENU_CATEGORIES = ['Main', 'Engagement', 'Core Themes', 'Resources', 'Tools'] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export interface MenuLink {
  href: string;
  label: string;
  icon: string;
  category: MenuCategory;
}

export const MENU_LINKS: MenuLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠', category: 'Main' },
  { href: '/survey-results', label: 'Survey Results', icon: '📊', category: 'Engagement' },
  { href: '/cew-2025', label: 'CEW Session', icon: '📅', category: 'Engagement' },
  { href: '/cew-results', label: 'CEW Session Results', icon: '📊', category: 'Engagement' },
  { href: '/twg/review', label: 'TWG White Paper Review', icon: '📝', category: 'Engagement' },
  { href: '/twg-results', label: 'TWG Interim Results', icon: '📝', category: 'Engagement' },
  { href: '/survey-results/holistic-protection', label: 'Holistic Protection', icon: '🛡️', category: 'Core Themes' },
  { href: '/survey-results/tiered-framework', label: 'Tiered Framework', icon: '📈', category: 'Core Themes' },
  { href: '/survey-results/prioritization', label: 'Prioritization Framework', icon: '🧪', category: 'Core Themes' },
  { href: '/wiks', label: 'Weaving Indigenous Knowledges & Science', icon: '🌿', category: 'Core Themes' },
  { href: '/twg/documents', label: 'Documents', icon: '📄', category: 'Resources' },
  { href: '/twg/discussions', label: 'Discussion Forum', icon: '💬', category: 'Resources' },
  { href: '/bn-rrm', label: 'BN-RRM Risk Assessment', icon: '🧬', category: 'Tools' }
];

