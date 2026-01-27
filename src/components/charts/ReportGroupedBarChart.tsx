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
  Legend,
} from 'recharts';
import { ChartDataItem } from '@/lib/chart_data';

interface ReportGroupedBarChartProps {
  data: {
    clarity: ChartDataItem[];
    completeness: ChartDataItem[];
    defensibility: ChartDataItem[];
  };
  title?: string;
  figureNumber?: string;
  caption?: string;
}

// Rating order for consistent sorting
const RATING_ORDER = ['Excellent', 'Good', 'Fair', 'Poor'];

export default function ReportGroupedBarChart({
  data,
  title,
  figureNumber,
  caption,
}: ReportGroupedBarChartProps) {
  const { theme, resolvedTheme } = useTheme();

  // Transform data into grouped format for recharts
  const groupedData = useMemo(() => {
    // Create a map to combine all ratings
    const dataMap = new Map<string, { name: string; clarity: number; completeness: number; defensibility: number }>();

    // Process clarity data
    data.clarity.forEach((item) => {
      if (!dataMap.has(item.name)) {
        dataMap.set(item.name, { name: item.name, clarity: 0, completeness: 0, defensibility: 0 });
      }
      const entry = dataMap.get(item.name);
      if (entry) {
        entry.clarity = item.value;
      }
    });

    // Process completeness data
    data.completeness.forEach((item) => {
      if (!dataMap.has(item.name)) {
        dataMap.set(item.name, { name: item.name, clarity: 0, completeness: 0, defensibility: 0 });
      }
      const entry = dataMap.get(item.name);
      if (entry) {
        entry.completeness = item.value;
      }
    });

    // Process defensibility data
    data.defensibility.forEach((item) => {
      if (!dataMap.has(item.name)) {
        dataMap.set(item.name, { name: item.name, clarity: 0, completeness: 0, defensibility: 0 });
      }
      const entry = dataMap.get(item.name);
      if (entry) {
        entry.defensibility = item.value;
      }
    });

    // Convert map to array and sort by rating order
    const result = Array.from(dataMap.values()).sort((a, b) => {
      const aIndex = RATING_ORDER.indexOf(a.name);
      const bIndex = RATING_ORDER.indexOf(b.name);
      // If rating not in order list, put it at the end
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return result;
  }, [data]);

  // Theme-aware colors - use resolvedTheme to handle SSR cases
  const currentTheme = resolvedTheme || theme || 'light';
  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827'; // text-white / text-gray-900
  const _secondaryTextColor = isDark ? '#d1d5db' : '#374151'; // text-gray-300 / text-gray-700
  const gridColor = isDark ? '#4b5563' : '#e5e7eb'; // gray-600 / gray-200
  const tooltipBg = isDark ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const tooltipBorder = isDark ? '#4b5563' : '#d1d5db';
  const tooltipText = isDark ? '#f3f4f6' : '#1f2937';

  // Category colors - different shades that work in both themes
  const clarityColor = isDark ? '#60a5fa' : '#3b82f6'; // blue-400 / blue-500
  const completenessColor = isDark ? '#34d399' : '#10b981'; // emerald-400 / emerald-500
  const defensibilityColor = isDark ? '#a78bfa' : '#8b5cf6'; // violet-400 / violet-500

  // Generate accessible aria-label
  const ariaLabel = useMemo(() => {
    const parts: string[] = [];
    if (figureNumber) parts.push(figureNumber);
    if (title) parts.push(title);
    if (caption) parts.push(caption);
    if (parts.length === 0) {
      parts.push('Grouped bar chart');
    }
    parts.push('Displaying three categories: Clarity, Completeness, and Defensibility');
    parts.push(`Showing ${groupedData.length} rating levels`);
    return parts.join('. ');
  }, [figureNumber, title, caption, groupedData.length]);

  // Custom tooltip component
  interface TooltipPayload {
    name: string;
    value: number;
    dataKey: string;
  }

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0 && label) {
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
          <p style={{ color: tooltipText, fontWeight: 600, marginBottom: '8px' }}>
            {label}
          </p>
          {payload.map((entry, index) => {
            const categoryName = entry.dataKey === 'clarity' ? 'Clarity' :
                                entry.dataKey === 'completeness' ? 'Completeness' :
                                entry.dataKey === 'defensibility' ? 'Defensibility' : entry.dataKey;
            return (
              <p key={index} style={{ color: tooltipText, marginBottom: '4px' }}>
                {categoryName}: <span style={{ fontWeight: 600 }}>{entry.value}</span>
              </p>
            );
          })}
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
            data={groupedData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              type="number"
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px', color: textColor }}
              iconType="square"
              formatter={(value) => {
                // Capitalize first letter
                return value.charAt(0).toUpperCase() + value.slice(1);
              }}
            />
            <Bar
              dataKey="clarity"
              fill={clarityColor}
              name="Clarity"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="completeness"
              fill={completenessColor}
              name="Completeness"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="defensibility"
              fill={defensibilityColor}
              name="Defensibility"
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

