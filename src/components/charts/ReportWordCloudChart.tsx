'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { WordCloudItem } from '@/lib/chart_data';

interface ReportWordCloudChartProps {
  data: WordCloudItem[];
  title?: string;
  figureNumber?: string;
  caption?: string;
}

export default function ReportWordCloudChart({
  data,
  title,
  figureNumber,
  caption,
}: ReportWordCloudChartProps) {
  const { theme, resolvedTheme } = useTheme();

  // Sort data by value (descending) - most frequent words at top
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.value - a.value);
  }, [data]);

  // Theme-aware colors - use resolvedTheme to handle SSR cases
  const currentTheme = resolvedTheme || theme || 'light';
  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827'; // text-white / text-gray-900
  const secondaryTextColor = isDark ? '#d1d5db' : '#374151'; // text-gray-300 / text-gray-700
  const gridColor = isDark ? '#4b5563' : '#e5e7eb'; // gray-600 / gray-200
  const tooltipBg = isDark ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const tooltipBorder = isDark ? '#4b5563' : '#d1d5db';
  const tooltipText = isDark ? '#f3f4f6' : '#1f2937';
  // Use a gradient-friendly color for word frequency bars
  const barColor = isDark ? '#3b82f6' : '#2563eb'; // blue-500 / blue-600

  // Generate accessible aria-label
  const ariaLabel = useMemo(() => {
    const parts: string[] = [];
    if (figureNumber) parts.push(figureNumber);
    if (title) parts.push(title);
    if (caption) parts.push(caption);
    if (parts.length === 0) {
      parts.push('Word frequency chart');
    }
    parts.push(`Displaying ${sortedData.length} words`);
    return parts.join('. ');
  }, [figureNumber, title, caption, sortedData.length]);

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: WordCloudItem }>;
  }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as WordCloudItem;
      return (
        <div
          style={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ color: tooltipText, fontWeight: 600, marginBottom: '4px' }}>
            {data.text}
          </p>
          <p style={{ color: tooltipText }}>
            Frequency: <span style={{ fontWeight: 600 }}>{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <figure
      role="figure"
      aria-label={ariaLabel}
      className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
    >
      {/* Figure Number */}
      {figureNumber && (
        <div className="mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {figureNumber}
          </span>
        </div>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}

      {/* Chart Container */}
      <div className="w-full" style={{ minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={400}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              type="number"
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
              label={{
                value: 'Frequency',
                position: 'insideBottom',
                offset: -10,
                style: { fill: secondaryTextColor, fontSize: 12 },
              }}
            />
            <YAxis
              type="category"
              dataKey="text"
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              fill={barColor}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Caption */}
      {caption && (
        <figcaption className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

