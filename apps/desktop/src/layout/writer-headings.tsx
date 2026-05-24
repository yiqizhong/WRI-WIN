import type { ReactNode } from "react";

/**
 * IBM Usage §Content hierarchy / §Continuity.
 * Tile section header — title (productive-heading-02) + optional description + actions.
 * Use this in every Tile that needs a heading. Never hand-roll <h2 style={{ fontSize }}>.
 */
type WriterSectionHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  /** Render as h2 (default) or h3 — controls semantics, not size. */
  as?: "h2" | "h3";
};

export function WriterSectionHeader({
  title,
  description,
  actions,
  id,
  as = "h2"
}: WriterSectionHeaderProps) {
  const Heading = as;

  return (
    <div className="writer-section-header">
      <div className="writer-section-header__body">
        <Heading id={id} className="writer-type-section-title">
          {title}
        </Heading>
        {description ? (
          <p className="writer-type-section-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="writer-section-header__actions">{actions}</div> : null}
    </div>
  );
}
