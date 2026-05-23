import type { ComponentProps, ReactNode } from "react";
import { Column, Grid, Stack } from "@carbon/react";

import { gridCell, stackFill } from "./writer-sizing";

/**
 * IBM 2× Grid (Carbon v11 CSS Grid).
 * @see https://www.ibm.com/design/language/2x-grid/
 * @see https://carbondesignsystem.com/elements/2x-grid/overview/
 */

/** 8px mini unit; spacing uses Carbon tokens (multiples of 8). */
export const WRITER_MINI_UNIT_PX = 8;

/** Carbon standard breakpoints (Overview tab). */
export const WRITER_GRID_BREAKPOINTS = {
  sm: { px: 320, columns: 4, margin: 0, padding: 16 },
  md: { px: 672, columns: 8, margin: 16, padding: 16 },
  lg: { px: 1056, columns: 16, margin: 16, padding: 16 },
  xlg: { px: 1312, columns: 16, margin: 16, padding: 16 },
  max: { px: 1584, columns: 16, margin: 24, padding: 16 }
} as const;

/** Product & docs style model: max content width at max breakpoint. */
export const WRITER_PRODUCT_MAX_WIDTH = "99rem";

export type WriterGutterMode = "wide" | "narrow" | "condensed";

export const WRITER_GRID_FULL = {
  sm: 4,
  md: 8,
  lg: 16,
  max: 16,
  xlg: 16
} as const;

/** 8+8 at lg (divide by two). */
export const WRITER_GRID_HALF = {
  sm: 4,
  md: 8,
  lg: 8,
  max: 8,
  xlg: 8
} as const;

/** Four-column IBM product pattern (4+4+4+4 at lg). */
export const WRITER_GRID_QUARTER = {
  sm: 4,
  md: 4,
  lg: 4,
  max: 4,
  xlg: 4
} as const;

/**
 * Three-column scaffolding on the 16-column 2× grid (Usage: odd column configurations).
 * Spans 5 + 6 + 5 = 16 at lg — legacy 12-col “groups of three” without FlexGrid.
 */
export const WRITER_GRID_THIRD_LEADING = {
  sm: 4,
  md: 8,
  lg: 5,
  max: 5,
  xlg: 5
} as const;

export const WRITER_GRID_THIRD_CENTER = {
  sm: 4,
  md: 8,
  lg: 6,
  max: 6,
  xlg: 6
} as const;

export const WRITER_GRID_THIRD_TRAILING = WRITER_GRID_THIRD_LEADING;

export type WriterGridThirdPosition = "leading" | "center" | "trailing";

function thirdColumnSpans(position: WriterGridThirdPosition) {
  switch (position) {
    case "leading":
      return WRITER_GRID_THIRD_LEADING;
    case "center":
      return WRITER_GRID_THIRD_CENTER;
    case "trailing":
      return WRITER_GRID_THIRD_TRAILING;
  }
}

type WriterPageGridProps = {
  children: ReactNode;
  className?: string;
  /** Usage: narrow = default product UI; wide = forms/inputs; condensed = dense tiles/dashboards. */
  gutterMode?: WriterGutterMode;
  /** Stretch row siblings to equal height (Review queue | changelog). */
  equalRowHeight?: boolean;
};

function gridModeProps(gutterMode: WriterGutterMode) {
  return {
    narrow: gutterMode === "narrow",
    condensed: gutterMode === "condensed"
  };
}

export function WriterPageGrid({
  children,
  className,
  gutterMode = "narrow",
  equalRowHeight = false
}: WriterPageGridProps) {
  const classes = [
    "writer-page-grid",
    equalRowHeight ? "writer-page-grid--equal-rows" : null,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Grid fullWidth className={classes} {...gridModeProps(gutterMode)}>
      {children}
    </Grid>
  );
}

type WriterPageColumnProps = ComponentProps<typeof Column> & {
  children: ReactNode;
  /** Fill available row height inside the grid (paired with equalRowHeight on grid). */
  fillHeight?: boolean;
};

export type WriterColumnSpans =
  | typeof WRITER_GRID_FULL
  | typeof WRITER_GRID_HALF
  | typeof WRITER_GRID_QUARTER
  | typeof WRITER_GRID_THIRD_LEADING
  | typeof WRITER_GRID_THIRD_CENTER;

type ColumnSpanProps = WriterPageColumnProps & {
  spans: WriterColumnSpans;
};

function WriterPageColumn({ spans, children, className, fillHeight = false, ...rest }: ColumnSpanProps) {
  return (
    <Column {...spans} className={className} {...rest}>
      <div className={gridCell(fillHeight)}>{children}</div>
    </Column>
  );
}

export function WriterPageGridFull({ children, className, fillHeight, ...rest }: WriterPageColumnProps) {
  return (
    <WriterPageColumn spans={WRITER_GRID_FULL} className={className} fillHeight={fillHeight} {...rest}>
      {children}
    </WriterPageColumn>
  );
}

export function WriterPageGridHalf({ children, className, fillHeight, ...rest }: WriterPageColumnProps) {
  return (
    <WriterPageColumn spans={WRITER_GRID_HALF} className={className} fillHeight={fillHeight} {...rest}>
      {children}
    </WriterPageColumn>
  );
}

export function WriterPageGridQuarter({ children, className, fillHeight, ...rest }: WriterPageColumnProps) {
  return (
    <WriterPageColumn spans={WRITER_GRID_QUARTER} className={className} fillHeight={fillHeight} {...rest}>
      {children}
    </WriterPageColumn>
  );
}

type WriterPageGridThirdProps = WriterPageColumnProps & {
  position: WriterGridThirdPosition;
};

export function WriterPageGridThird({
  position,
  children,
  className,
  fillHeight,
  ...rest
}: WriterPageGridThirdProps) {
  return (
    <WriterPageColumn
      spans={thirdColumnSpans(position)}
      className={className}
      fillHeight={fillHeight}
      {...rest}
    >
      {children}
    </WriterPageColumn>
  );
}

type WriterPageStackProps = {
  children: ReactNode;
  gap?: ComponentProps<typeof Stack>["gap"];
  /** Fill remaining height inside a fill-height grid cell. */
  fill?: boolean;
};

/** Vertical rhythm inside a grid column (2x, 3x, 4x … mini-unit spacing via Carbon gap scale). */
export function WriterPageStack({ children, gap = 7, fill = false }: WriterPageStackProps) {
  return (
    <Stack gap={gap} className={fill ? stackFill : undefined}>
      {children}
    </Stack>
  );
}
