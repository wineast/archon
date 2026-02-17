export type WelcomeIconKey = "" | "sparkles" | "bot" | "brain" | "message-square" | "wand" | "zap" | "lightbulb" | "rocket";

export interface ChatConfig {
  title: string;
  welcomeTitle: string;
  welcomeIcon: WelcomeIconKey;
  quickActions: string[];
  placeholder: string;
  suggestions: string[];
}

export const DEFAULT_TITLE = "";
export const DEFAULT_WELCOME_TITLE = "";
export const DEFAULT_WELCOME_ICON: WelcomeIconKey = "";
export const DEFAULT_QUICK_ACTIONS: string[] = [];
export const DEFAULT_PLACEHOLDER = "";
export const DEFAULT_SUGGESTIONS: string[] = [];
