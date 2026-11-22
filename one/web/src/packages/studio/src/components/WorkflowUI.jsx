"use client";

import React, { useEffect, useState } from "react";
import { WorkflowBuilder } from "workflow-builder";
import { SpatialBackground } from "../ui";
import "reactflow/dist/style.css";
import "react-toastify/dist/ReactToastify.css";

const WorkflowUI = ({
  apiKey,
  workflowId,
  initialNodeSchemas,
  initialWorkflowData,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
}) => {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    sessionStorage.setItem("fromWorkflowBuilder", "true");
    return () => sessionStorage.removeItem("fromWorkflowBuilder");
  }, []);

  const handlePointerMove = (e) => {
    if (e.buttons > 0) {
      setParallax((prev) => ({
        x: prev.x + (e.movementX || 0),
        y: prev.y + (e.movementY || 0),
      }));
    }
  };

  const handleWheel = (e) => {
    setParallax((prev) => ({
      x: prev.x - (e.deltaX || 0) * 0.4,
      y: prev.y - (e.deltaY || 0) * 0.4,
    }));
  };

  return (
    <div
      className="w-full h-full bg-[#050507] relative overflow-hidden"
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
    >
      <SpatialBackground
        variant="canvas"
        isFixed={false}
        parallaxOffset={parallax}
        showArc={false}
      />
      <div className="relative z-[1] w-full h-full">
        <WorkflowBuilder
          apiKey={apiKey}
          workflowId={workflowId}
          initialNodeSchemas={initialNodeSchemas}
          initialWorkflowData={initialWorkflowData}
          costType="dollars"
          onGenerationStart={onGenerationStart}
          onGenerationEnd={onGenerationEnd}
          onGenerationComplete={onGenerationComplete}
          onGenerationError={onGenerationError}
        />
      </div>
    </div>
  );
};

export default WorkflowUI;
