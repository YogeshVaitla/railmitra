// RailMitra — Warm Light Theme Design System
// Senior-friendly: high contrast, warm tones, clear hierarchy

export const Colors = {
  // Primary — warm coral/orange
  primary: {
    start: '#E8614D',
    end: '#F2994A',
    light: '#FFF0EB',    // tinted background
  },

  // Accent — soft teal for secondary actions
  accent: {
    start: '#2D9CDB',
    end: '#56CCF2',
    light: '#E8F4FD',
  },

  // Success
  success: {
    start: '#27AE60',
    end: '#6FCF97',
    light: '#E8F8F0',
  },

  // Warning
  warning: {
    start: '#F2994A',
    end: '#F2C94C',
    light: '#FFF5E6',
  },

  // Danger
  danger: {
    start: '#EB5757',
    end: '#F45C43',
    light: '#FDECEC',
  },

  // Backgrounds
  background: {
    primary: '#FFF8F3',      // warm cream
    secondary: '#FFFFFF',    // pure white cards
    tertiary: '#F5F0EB',     // subtle warm gray
    dark: ['#0f0c29', '#302b63', '#24243e'], // kept for compatibility
    light: ['#FFF8F3', '#FFF0EB', '#FFFFFF'],
  },

  // Cards & Surfaces
  card: {
    background: '#FFFFFF',
    border: '#F0E6DE',
    shadow: 'rgba(200, 150, 100, 0.12)',
    elevated: '#FFFFFF',
  },

  // Text — high contrast
  text: {
    primary: '#1A1A2E',       // near-black
    secondary: '#555555',     // medium gray
    tertiary: '#888888',      // light gray
    inverse: '#FFFFFF',       // white on dark
    dark: '#1A1A2E',
    darkSecondary: '#555',
  },

  // Status colors
  vacant: '#27AE60',
  occupied: '#EB5757',
  rac: '#F2994A',
  waitlist: '#EB5757',

  // Swap status
  status: {
    active: '#27AE60',
    matched: '#2D9CDB',
    accepted: '#6C63FF',
    completed: '#27AE60',
    cancelled: '#888888',
    expired: '#888888',
    withdrawn: '#888888',
  },

  // Berth types
  berth: {
    lower: '#E8614D',
    middle: '#F2994A',
    upper: '#2D9CDB',
    sideLower: '#27AE60',
    sideUpper: '#6C63FF',
  },

  // Misc
  divider: '#F0E6DE',
  shadow: 'rgba(0, 0, 0, 0.08)',
  chartPrepared: '#27AE60',
  chartNotPrepared: '#F2994A',

  // Glass (kept for backward compat, now light-themed)
  glass: {
    background: 'rgba(255, 255, 255, 0.9)',
    backgroundLight: 'rgba(255, 255, 255, 0.95)',
    border: '#F0E6DE',
    borderLight: '#E8DDD4',
  },
};

export default Colors;
