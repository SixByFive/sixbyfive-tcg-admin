// FILE: apps/desktop/src/renderer/src/components/StatPill.jsx

import React from "react";

export default function StatPill({ label, value }) {
  return (
    <div className="vlStat">
      <div className="vlStatValue">{value}</div>
      <div className="vlStatLabel">{label}</div>
    </div>
  );
}