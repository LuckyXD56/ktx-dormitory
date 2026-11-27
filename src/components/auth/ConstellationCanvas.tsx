"use client";

import React, { useEffect, useRef } from "react";

interface StarNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isGold: boolean;
  phase: number;
  twinkleSpeed: number;
}

/**
 * Lightweight HiDPI HTML5 Canvas rendering drifting stars and delicate
 * constellation lines with gentle cursor interaction and reduced-motion support.
 */
export function ConstellationCanvas({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: StarNode[] = [];
    let animId = 0;
    let mouse = { x: -9999, y: -9999, active: false };

    const initStars = () => {
      const area = width * height;
      const count = Math.max(28, Math.min(72, Math.floor(area / 12000)));
      stars = Array.from({ length: count }, (_, idx) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        radius: idx % 5 === 0 ? 1.8 + Math.random() * 1.1 : 1 + Math.random() * 1.1,
        isGold: idx % 4 === 0,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.015 + Math.random() * 0.02,
      }));
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const onMouseLeave = () => {
      mouse.active = false;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    const maxLinkDist = 130;
    const mouseDist = 165;

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!reducedMotion) {
          s.x += s.vx;
          s.y += s.vy;
          s.phase += s.twinkleSpeed;

          if (s.x < -10) s.x = width + 10;
          else if (s.x > width + 10) s.x = -10;
          if (s.y < -10) s.y = height + 10;
          else if (s.y > height + 10) s.y = -10;

          if (mouse.active) {
            const dx = mouse.x - s.x;
            const dy = mouse.y - s.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1 && dist < mouseDist) {
              const pull = (1 - dist / mouseDist) * 0.012;
              s.x += dx * pull;
              s.y += dy * pull;
            }
          }
        }
      }

      // Draw constellation connection lines
      ctx.lineWidth = 0.85;
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxLinkDist) {
            const strength = 1 - dist / maxLinkDist;
            const usesGold = a.isGold || b.isGold;
            ctx.strokeStyle = usesGold
              ? `rgba(251, 191, 36, ${(strength * 0.24).toFixed(3)})`
              : `rgba(191, 219, 254, ${(strength * 0.2).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // Interactive cursor constellation lines
        if (mouse.active && !reducedMotion) {
          const mdx = mouse.x - a.x;
          const mdy = mouse.y - a.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < mouseDist) {
            const mStrength = 1 - mDist / mouseDist;
            ctx.strokeStyle = `rgba(252, 211, 77, ${(mStrength * 0.38).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = reducedMotion ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase));

        if (s.isGold) {
          ctx.fillStyle = `rgba(251, 191, 36, ${(twinkle * 0.25).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3.1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(253, 224, 71, ${(0.55 + twinkle * 0.45).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(219, 234, 254, ${(0.35 + twinkle * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reducedMotion && !document.hidden) {
        animId = window.requestAnimationFrame(drawFrame);
      }
    };

    const onVisibility = () => {
      if (!document.hidden && !reducedMotion) {
        window.cancelAnimationFrame(animId);
        animId = window.requestAnimationFrame(drawFrame);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    drawFrame();

    return () => {
      window.cancelAnimationFrame(animId);
      ro.disconnect();
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}
