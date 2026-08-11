// FILE: apps/desktop/src/renderer/src/components/Button.jsx

import React from "react";

export default function Button({
  variant = "primary", // primary | secondary | ghost
  disabled = false,
  onClick,
  children,
  title,
  type = "button",
}) {
  const cls =
    variant === "secondary"
      ? "vlBtn secondary"
      : variant === "ghost"
      ? "vlBtn ghost"
      : "vlBtn primary";

  return (
    <button className={cls} disabled={disabled} onClick={onClick} title={title} type={type}>
      {children}
    </button>
  );
}