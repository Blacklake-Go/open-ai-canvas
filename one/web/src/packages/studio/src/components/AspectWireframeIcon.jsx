"use client";

import React from "react";

/**
 * AspectWireframeIcon renders a geometric wireframe preview of an aspect ratio.
 * Perfectly adapts to 1:1, 16:9, 9:16, 4:3, 3:4, 21:9, 3:2, 2:3, auto, etc.
 */
export function AspectWireframeIcon({
  ratio = "1:1",
  active = false,
  className = "",
}) {
  const r = String(ratio || "1:1").toLowerCase().trim();
  const isAuto =
    r === "auto" ||
    r.includes("自动") ||
    r.includes("smart") ||
    r.includes("自适应");

  // Determine wireframe dimensions within a 26x26 container
  let boxStyle = { width: "16px", height: "16px" };

  if (isAuto) {
    boxStyle = { width: "18px", height: "18px" };
  } else if (r === "1:1") {
    boxStyle = { width: "16px", height: "16px" };
  } else if (r === "16:9") {
    boxStyle = { width: "24px", height: "13.5px" };
  } else if (r === "9:16") {
    boxStyle = { width: "13.5px", height: "24px" };
  } else if (r === "4:3") {
    boxStyle = { width: "20px", height: "15px" };
  } else if (r === "3:4") {
    boxStyle = { width: "15px", height: "20px" };
  } else if (r === "21:9") {
    boxStyle = { width: "26px", height: "11px" };
  } else if (r === "3:2") {
    boxStyle = { width: "21px", height: "14px" };
  } else if (r === "2:3") {
    boxStyle = { width: "14px", height: "21px" };
  } else if (r === "5:4") {
    boxStyle = { width: "20px", height: "16px" };
  } else if (r === "4:5") {
    boxStyle = { width: "16px", height: "20px" };
  } else {
    const parts = r.split(":");
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w && h) {
        if (w >= h) {
          const width = 24;
          const height = Math.max(8, Math.round((24 * h) / w));
          boxStyle = { width: `${width}px`, height: `${height}px` };
        } else {
          const height = 24;
          const width = Math.max(8, Math.round((24 * w) / h));
          boxStyle = { width: `${width}px`, height: `${height}px` };
        }
      }
    }
  }

  return (
    <div
      className={`w-7 h-7 flex items-center justify-center shrink-0 pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <div
        style={boxStyle}
        className={`border-[1.5px] transition-[border-color,background-color] duration-fast ease-standard flex items-center justify-center ${
          isAuto ? "border-dashed" : "border-solid"
        } ${
          active
            ? "border-brand bg-brand-soft"
            : "border-line text-ink-muted group-hover:border-line-strong"
        } rounded-[3px]`}
      >
        {isAuto && (
          <span
            className={`text-[8.5px] font-black leading-none uppercase ${
              active ? "text-brand" : "text-ink-subtle"
            }`}
          >
            A
          </span>
        )}
      </div>
    </div>
  );
}

export default AspectWireframeIcon;
