// FILE: apps/desktop/src/renderer/src/pages/ExportPage.jsx

import React from "react";
import Card from "./components/Card";

export default function ExportPage() {
  return (
    <div className="vlGrid">
      <div className="vlCol">
        <Card
          title="Export"
          subtitle="TFJS is the primary output for on-device use."
        >
          <div className="vlMutedSmall">
            We’ll add:
            <ul className="vlBullet">
              <li>Export TFJS (model.json + shards)</li>
              <li>Optional quantized outputs</li>
              <li>One-click copy into your Expo app assets</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}