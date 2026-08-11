// FILE: apps/desktop/src/renderer/src/components/Card.jsx
//
// UPDATED (2026-03-04)
//
// CHANGES:
// - ADD: Support `className` on the outer card container.
// - ADD: Support `bodyClassName` on the body wrapper (handy for scroll regions).
// - KEEP: Existing structure + classnames unchanged (vlCard/vlCardHeader/vlCardBody)

import React from "react";

export default function Card({
  title,
  subtitle,
  right,
  children,
  className, // ✅ ADDED
  bodyClassName, // ✅ ADDED
}) {
  const rootClass = ["vlCard", className].filter(Boolean).join(" ");
  const bodyClass = ["vlCardBody", bodyClassName].filter(Boolean).join(" ");

  return (
    <section className={rootClass}>
      {(title || subtitle || right) && (
        <div className="vlCardHeader">
          <div>
            {title && <div className="vlCardTitle">{title}</div>}
            {subtitle && <div className="vlCardSub">{subtitle}</div>}
          </div>
          {right ? <div className="vlCardRight">{right}</div> : null}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}