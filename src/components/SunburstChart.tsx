import { arc as d3Arc, hierarchy, partition as d3Partition } from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatBytes, formatCount } from "../lib/format";
import type { ViewNode } from "../lib/types";
import styles from "./SunburstChart.module.css";

type SunburstChartProps = {
  data: ViewNode | null;
  selectedPath: string | null;
  canZoomOut: boolean;
  isDark: boolean;
  onSelect: (node: ViewNode) => void;
  onZoomIn: (node: ViewNode) => void;
  onZoomOut: () => void;
};

type ArcDatum = {
  node: ViewNode;
  path: string;
  depth: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
};

type TooltipState = {
  x: number;
  y: number;
  node: ViewNode;
};

/**
 * ノード名からテーマ両対応の安定色を返す
 * @param name
 * @param depth
 * @param isDark
 * @returns
 */
function arcColor(name: string, depth: number, isDark: boolean): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  const saturation = isDark ? 46 : 54;
  const lightness = isDark ? 40 + (depth % 3) * 7 : 50 + (depth % 3) * 6;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/**
 * 階層データからサンバースト用アークを作る
 * @param data
 * @param radius
 * @returns
 */
function buildArcs(data: ViewNode, radius: number): ArcDatum[] {
  const hole = radius * 0.3;
  const root = hierarchy(data, (node) => node.children)
    .sum((node) => (node.children.length > 0 ? 0 : Math.max(node.size, 0)))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
  const partitioned = d3Partition<ViewNode>().size([2 * Math.PI, radius])(root);
  const scale = (value: number) => hole + ((radius - hole) * value) / radius;

  return partitioned
    .descendants()
    .filter((item) => item.depth > 0 && item.x1 - item.x0 > 0.004)
    .map((item) => ({
      node: item.data,
      path: item.data.path,
      depth: item.depth,
      startAngle: item.x0,
      endAngle: item.x1,
      innerRadius: scale(item.y0),
      outerRadius: Math.max(scale(item.y1) - 1.5, scale(item.y0) + 2),
    }));
}

/**
 * ディスク使用量のサンバーストを描画する
 * @param props
 * @returns
 */
export function SunburstChart({
  data,
  selectedPath,
  canZoomOut,
  isDark,
  onSelect,
  onZoomIn,
  onZoomOut,
}: SunburstChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(360);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const next = Math.max(220, Math.min(entry.contentRect.width, entry.contentRect.height));
      setSize(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const arcs = useMemo(() => {
    if (!data || data.size <= 0) {
      return [];
    }
    return buildArcs(data, size / 2 - 8);
  }, [data, size]);

  const arcGenerator = useMemo(
    () =>
      d3Arc<ArcDatum>()
        .startAngle((item) => item.startAngle)
        .endAngle((item) => item.endAngle)
        .innerRadius((item) => item.innerRadius)
        .outerRadius((item) => item.outerRadius),
    [],
  );

  if (!data) {
    return (
      <div className={styles.root} ref={rootRef}>
        <p className={styles.empty}>表示するデータがありません</p>
      </div>
    );
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <svg
        className={styles.svg}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        role="img"
        aria-label={`${data.name} の容量分布`}
      >
        <circle
          className={styles.centerHit}
          r={size * 0.14}
          fill="var(--surface)"
          stroke="var(--border)"
          onClick={() => {
            if (canZoomOut) {
              onZoomOut();
            } else {
              onSelect(data);
            }
          }}
        />
        <text
          textAnchor="middle"
          dy="-0.2em"
          fill="var(--text)"
          fontSize={Math.max(11, size * 0.035)}
        >
          {data.name}
        </text>
        <text
          textAnchor="middle"
          dy="1.2em"
          fill="var(--muted)"
          fontSize={Math.max(10, size * 0.03)}
        >
          {formatBytes(data.size)}
        </text>
        {arcs.map((item) => {
          const path = arcGenerator(item);
          if (!path) {
            return null;
          }
          const selected = item.node.path === selectedPath;
          return (
            <path
              key={`${item.path}-${item.depth}-${item.startAngle}`}
              d={path}
              fill={
                item.node.isOther
                  ? "var(--border)"
                  : arcColor(item.node.name, item.depth, isDark)
              }
              stroke={selected ? "var(--text)" : "var(--bg)"}
              strokeWidth={selected ? 2 : 0.6}
              onClick={() => onSelect(item.node)}
              onDoubleClick={() => {
                if (item.node.isDir && !item.node.isOther) {
                  onZoomIn(item.node);
                }
              }}
              onMouseMove={(mouseEvent) => {
                const bounds = rootRef.current?.getBoundingClientRect();
                if (!bounds) {
                  return;
                }
                setTooltip({
                  x: mouseEvent.clientX - bounds.left + 12,
                  y: mouseEvent.clientY - bounds.top + 12,
                  node: item.node,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
        {arcs
          .filter((item) => item.node.path === selectedPath)
          .map((item) => {
            const path = arcGenerator(item);
            if (!path) {
              return null;
            }
            return (
              <path
                key={`selected-${item.path}-${item.depth}`}
                d={path}
                fill="none"
                stroke="var(--text)"
                strokeWidth={2}
                pointerEvents="none"
              />
            );
          })}
      </svg>
      {tooltip ? (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className={styles.tooltipName}>{tooltip.node.name}</div>
          <div className={styles.tooltipMeta}>
            {tooltip.node.isDir
              ? `${formatBytes(tooltip.node.size)} / ${formatCount(tooltip.node.fileCount)}`
              : formatBytes(tooltip.node.size)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
