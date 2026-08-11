// FILE: apps/desktop/src/renderer/src/components/Sidebar.jsx

import React from "react";

export default function Sidebar({ tabs, activeTab, onChangeTab }) {
  return (
    <aside className="vlSidebar">
      <div className="vlNavTitle">Workspace</div>

      <nav className="vlNav">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === activeTab ? "vlNavItem active" : "vlNavItem"}
            onClick={() => onChangeTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="vlSidebarFooter">
        <div className="vlMutedSmall">
          Built for long-term dataset hygiene and TFJS exports.
        </div>
      </div>
    </aside>
  );
}