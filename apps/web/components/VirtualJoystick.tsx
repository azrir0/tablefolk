"use client";

import React, { useRef, useState } from "react";

interface VirtualJoystickProps {
  onVectorChange: (vx: number, vy: number) => void;
}

export function VirtualJoystick({ onVectorChange }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePointer = useRef<number | null>(null);
  const maxR = 34;

  function updateFromClientPos(clientX: number, clientY: number) {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onVectorChange(dx / maxR, dy / maxR);
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientPos(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        updateFromClientPos(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointer.current !== e.pointerId) return;
        activePointer.current = null;
        setKnob({ x: 0, y: 0 });
        onVectorChange(0, 0);
      }}
      onPointerCancel={() => {
        activePointer.current = null;
        setKnob({ x: 0, y: 0 });
        onVectorChange(0, 0);
      }}
      className="relative flex h-24 w-24 touch-none select-none items-center justify-center rounded-full border-2 border-oat-300 bg-oat-50/75 shadow-cozy backdrop-blur"
    >
      <div
        className="h-10 w-10 rounded-full bg-sage-500/90 shadow-md transition-transform duration-75"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
