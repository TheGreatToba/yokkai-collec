"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { Card } from "@/lib/data/cards";
import { YokaiCard } from "@/components/yokai-card";
import "@/styles/lr-card-reveal.css";

// Final reference timings: four stroke passes, slide/spin, glass, labels, art, impact.
const lines = [
  [13.0, 26.0, 84.0, -14],
  [71.0, 22.0, 73.0, -26],
  [18.0, 51.0, 104.0, -9],
  [77.0, 54.0, 68.0, -18],
  [28.0, 72.0, 74.0, -29],
  [46.0, 24.0, 70.0, -7],
  [15.0, 12.0, 66.0, -18],
  [91.0, 34.0, 68.0, -27],
  [4.0, 58.0, 92.0, -9],
  [49.0, 77.0, 62.0, -34],
  [13.0, 87.0, 54.0, 23],
  [94.0, 64.0, 52.0, -20]
];
const dots = [
  [12.0, 25.0],
  [68.0, 23.0],
  [17.0, 52.0],
  [63.0, 67.0],
  [87.0, 79.0],
  [58.0, 9.0],
  [6.0, 58.0],
  [87.0, 84.0]
];
const phases = [
  [0.048, 0.03257, 0.068, 0.04412, 0.234, 0.203],
  [1.058, 0.01335, 1.079, 0.018, 0.195, 0.179],
  [1.586, 0.01657, 1.607, 0.02241, 0.234, 0.203],
  [2.185, 0.0207, 2.205, 0.02806, 0.203, 0.234]
];
const streaks = [
  [40, -20, 5.6, 0],
  [62, 17, 6.8, -2.1],
  [24, -38, 7.6, -4.1],
  [13, 12, 3.5, -0.1],
  [29, -27, 4.7, -1.6],
  [42, 34, 4.1, -2.6],
  [56, -12, 3.8, -0.9],
  [71, 23, 5.3, -3.2],
  [83, -41, 4.5, -2]
];

export function LrCardReveal({
  card,
  onContinue
}: {
  card: Pick<Card, "name" | "category" | "anime" | "image" | "rarity">;
  onContinue?: () => void;
}) {
  const callback = useRef(onContinue);
  const completed = useRef(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    callback.current = onContinue;
  }, [onContinue]);
  const advance = () => {
    if (completed.current) return;
    completed.current = true;
    root.current
      ?.getAnimations({ subtree: true })
      .forEach(animation => animation.pause());
    callback.current?.();
  };
  useEffect(() => {
    completed.current = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(advance, reduced.matches ? 700 : 15370);
    // CSS timelines belong to these DOM nodes and disappear with them.
    // Do not cancel them during StrictMode's simulated cleanup: it keeps the DOM.
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section
      ref={root}
      className="yk-lr-reveal yk-card-cinematic"
      aria-label={`LR cinematic: ${card.name}`}
    >
      <div className="yk-lr-world" aria-hidden="true" />
      <div className="yk-lr-intro" aria-hidden="true" />
      <div className="yk-lr-traits" aria-hidden="true">
        {phases.map(
          (
            [lineStart, lineStep, dotStart, dotStep, lineDuration, dotDuration],
            phase
          ) => (
            <div className={`yk-lr-phase yk-lr-phase-${phase}`} key={phase}>
              {lines.map(([x, y, width, angle], index) => (
                <i
                  key={`l${index}`}
                  className="yk-lr-stroke"
                  style={
                    {
                      left: `${x}%`,
                      top: `${y}%`,
                      width: `${width}px`,
                      "--rot": `${angle}deg`,
                      animationDelay: `${(lineStart + lineStep * index).toFixed(3)}s`,
                      animationDuration: `${lineDuration}s`
                    } as CSSProperties
                  }
                />
              ))}
              {dots.map(([x, y], index) => (
                <i
                  key={`d${index}`}
                  className="yk-lr-dot"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    animationDelay: `${(dotStart + dotStep * index).toFixed(3)}s`,
                    animationDuration: `${dotDuration}s`
                  }}
                />
              ))}
            </div>
          )
        )}
      </div>
      <div className="yk-lr-finale" aria-hidden="true">
        {streaks.map(([top, angle, duration, delay], index) => (
          <i
            className="yk-lr-streak"
            key={index}
            style={
              {
                top: `${top}%`,
                "--angle": `${angle}deg`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`
              } as CSSProperties
            }
          />
        ))}
        {Array.from({ length: 24 }, (_, index) => (
          <i
            className="yk-lr-glitter"
            key={`g${index}`}
            style={{
              left: `${(index * 37 + 19) % 100}%`,
              top: `${(index * 23 + 34) % 100}%`,
              animationDelay: `${index * 0.091}s`
            }}
          />
        ))}
        {Array.from({ length: 50 }, (_, index) => (
          <i
            className="yk-lr-confetti"
            key={`c${index}`}
            style={
              {
                left: `${(index * 31 + 7) % 100}%`,
                "--drift": `${((index % 7) - 3) * 17}px`,
                animationDelay: `${3.354 + (index % 12) * 0.17}s`,
                animationDuration: `${3.5 + (index % 5) * 0.4}s`
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="yk-lr-floor" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 37 + 11) % 100}%`,
              bottom: `${index % 4}px`,
              transform: `rotate(${index * 29}deg)`,
              animationDelay: `${6.854 + (index % 12) * 0.17}s`
            }}
          />
        ))}
      </div>
      <div className="yk-lr-stage">
        {[0, 1, 2].map(index => (
          <i
            key={index}
            className={`yk-lr-corner yk-lr-corner-${index}`}
            aria-hidden="true"
          />
        ))}
        <div className="yk-lr-float">
          <div className="yk-lr-edge" aria-hidden="true" />
          <div className="yk-lr-spin">
            <YokaiCard {...card} rarity="LR" animated={false} />
            <div className="yk-lr-glass" aria-hidden="true" />
            <div className="yk-lr-rim" aria-hidden="true" />
          </div>
        </div>
      </div>
      {onContinue && (
        <button
          type="button"
          className="yk-lr-skip"
          aria-label="Skip cinematic"
          onClick={advance}
        />
      )}
    </section>
  );
}
