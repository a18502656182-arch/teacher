import type { CSSProperties } from 'react';
import type { ThemeDefinition } from './contracts';

export type ThemeCssVariables = CSSProperties & Record<`--wb-${string}`, string>;

export function themeCssVariables(theme: ThemeDefinition): ThemeCssVariables {
  const { semanticColors: colors, surfaces, typography, spacing, radii, elevation, motion } = theme;
  return {
    '--wb-canvas': colors.surface.canvas,
    '--wb-work-solid': surfaces.work.solid,
    '--wb-work-enhanced': surfaces.work.enhanced,
    '--wb-context': colors.surface.context,
    '--wb-assist': colors.surface.assist,
    '--wb-attention': colors.surface.attention,
    '--wb-disabled': colors.surface.disabled,
    '--wb-ink': colors.text.main,
    '--wb-muted': colors.text.muted,
    '--wb-on-primary': colors.text.onPrimary,
    '--wb-primary': colors.action.primary,
    '--wb-primary-hover': colors.action.primaryHover,
    '--wb-danger': colors.status.danger,
    '--wb-danger-soft': colors.status.dangerSoft,
    '--wb-success': colors.status.success,
    '--wb-warning': colors.status.warning,
    '--wb-line': colors.line.subtle,
    '--wb-control-line': colors.line.control,
    '--wb-font': typography.family,
    '--wb-text': typography.body,
    '--wb-text-small': typography.small,
    '--wb-heading-desktop': typography.heading,
    '--wb-heading-mobile': typography.mobileHeading,
    '--wb-line-height': typography.lineHeight,
    '--wb-space-small': spacing.small,
    '--wb-space-control': spacing.control,
    '--wb-space-group': spacing.group,
    '--wb-space-section': spacing.section,
    '--wb-radius-control': radii.control,
    '--wb-radius-surface': radii.surface,
    '--wb-elevation-dialog': elevation.dialog,
    '--wb-backdrop': surfaces.backdrop,
    '--wb-material-blur-ready': surfaces.work.blur,
    '--wb-motion-duration-ready': motion.duration,
    '--wb-motion-easing': motion.easing,
  };
}
