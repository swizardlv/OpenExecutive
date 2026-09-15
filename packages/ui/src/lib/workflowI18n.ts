// Localization helpers for Executive Jobs / Workflows
// Uses the centralized locales registry supporting arbitrary languages.

import { translate } from "@/locales";

export function getWorkflowTitle(name: string, fallback: string, locale: string): string {
  const translated = translate(locale, `workflows.${name}.title`, undefined, "");
  return translated || fallback;
}

export function getWorkflowDescription(name: string, fallback: string, locale: string): string {
  const translated = translate(locale, `workflows.${name}.desc`, undefined, "");
  return translated || fallback;
}

export function getWorkflowFieldLabel(fieldName: string, fallback: string, locale: string): string {
  const translated = translate(locale, `workflows.field.${fieldName}`, undefined, "");
  return translated || fallback;
}
