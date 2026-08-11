// FILE: apps/desktop/src/renderer/src/components/Topbar.jsx

import React from "react";

export default function Topbar() {
  return (
    <header className="vlTopbar">
      <div className="vlBrand">
        <div className="vlBrandDot" />
        <div className="vlBrandText">
          <div className="vlBrandTitle">SBF Vision Lab</div>
          <div className="vlBrandSub">Dataset → Process → Train → Export TFJS → Test</div>
        </div>
      </div>

      <div className="vlTopHint">
        <span className="vlKbd">F12</span> DevTools
      </div>
    </header>
  );
}