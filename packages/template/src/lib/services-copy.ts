import type { ClientConfig } from "@hirobius/schema";

export const DEFAULT_SERVICES_TITLE = "What We Do";
export const DEFAULT_SERVICES_SUBTITLE = "Professional service, done right the first time.";

/** Services section heading copy: the config override, else today's default. */
export function servicesCopy(config: Pick<ClientConfig, "copy">): { title: string; subtitle: string } {
  return {
    title: config.copy.servicesTitle ?? DEFAULT_SERVICES_TITLE,
    subtitle: config.copy.servicesSubtitle ?? DEFAULT_SERVICES_SUBTITLE,
  };
}
