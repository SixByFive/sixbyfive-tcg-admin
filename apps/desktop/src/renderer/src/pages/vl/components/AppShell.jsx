// FILE: apps/desktop/src/renderer/src/components/AppShell.jsx

import React from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

/**
 * CHANGES:
 * - KEPT: simple shell
 * - RELIES ON CSS: body overflow hidden; main scrolls; sticky topbar/sidebar
 */

export default function AppShell({ tabs, activeTab, onChangeTab, children }) {
  return (
    <div className="vlRoot">
      <Topbar />
      <div className="vlBody">
        <Sidebar tabs={tabs} activeTab={activeTab} onChangeTab={onChangeTab} />
        <main className="vlMain">{children}</main>
      </div>
    </div>
  );
}