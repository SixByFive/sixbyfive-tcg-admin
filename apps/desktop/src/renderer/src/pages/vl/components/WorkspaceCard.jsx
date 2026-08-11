// FILE: apps/desktop/src/renderer/src/components/WorkspaceCard.jsx

import React from "react";
import Card from "./Card";
import Button from "./Button";

export default function WorkspaceCard({
  workspacePath,
  status, // { kind, message? }
  onChangeWorkspace,
  onOpenWorkspace,
}) {
  const statusLine =
    status?.kind === "loading"
      ? "Loading…"
      : status?.kind === "error"
      ? status.message || "Error"
      : workspacePath
      ? workspacePath
      : "No workspace selected yet.";

  return (
    <Card
      title="Workspace"
      subtitle="Your persistent storage root (datasets, exports, logs)."
      right={
        <div className="vlRow">
          <Button variant="secondary" onClick={onOpenWorkspace} disabled={!workspacePath || status?.kind === "loading"}>
            Open
          </Button>
          <Button onClick={onChangeWorkspace} disabled={status?.kind === "loading"}>
            {workspacePath ? "Change" : "Select"}
          </Button>
        </div>
      }
    >
      <div className={status?.kind === "error" ? "vlMono error" : "vlMono"}>
        {statusLine}
      </div>

      <div className="vlMutedSmall" style={{ marginTop: 10 }}>
        Manifest: <code>datasets/dataset.json</code>
      </div>
    </Card>
  );
}