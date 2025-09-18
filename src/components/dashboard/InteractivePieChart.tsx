// src/components/dashboard/InteractivePieChart.tsx
'use client';

import { useState } from 'react';

interface PieChartData {
  label: string;
  value: number;
  color: string;
  description?: string;
}

interface InteractivePieChartProps {
  data: PieChartData[];
  title: string;
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
  interactive?: boolean;
}

export default function InteractivePieChart({
  data,
  title,
  size = 'md',
  showLegend = true,
  interactive = true,
}: InteractivePieChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);

  // Safety check for empty data
  if (!data || data.length === 0) {
    return (
      <div className="relative">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h3>
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      </div>
    );
  }

  // Calculate total for percentages with NaN protection
  const total = data.reduce((sum, item) => {
    const value = isNaN(item.value) ? 0 : item.value;
    return sum + value;
  }, 0);
  
  // Calculate angles for pie slices with NaN protection
  let currentAngle = 0;
  const slices = data.map((item, index) => {
    const value = isNaN(item.value) ? 0 : item.value;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + (percentage / 100) * 360;
    currentAngle = endAngle;
    
    return {
      ...item,
      value: value,
      percentage: isNaN(percentage) ? 0 : percentage,
      startAngle: isNaN(startAngle) ? 0 : startAngle,
      endAngle: isNaN(endAngle) ? 0 : endAngle,
      index,
    };
  });

  // Size configurations
  const sizeConfig = {
    sm: { radius: 80, strokeWidth: 20, fontSize: 'text-sm' },
    md: { radius: 120, strokeWidth: 30, fontSize: 'text-base' },
    lg: { radius: 160, strokeWidth: 40, fontSize: 'text-lg' },
  };

  const { radius, strokeWidth, fontSize } = sizeConfig[size];
  const centerX = radius + 20;
  const centerY = radius + 20;

  // Convert polar coordinates to Cartesian
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    // Ensure angleInDegrees is a valid number
    const validAngle = isNaN(angleInDegrees) ? 0 : angleInDegrees;
    const angleInRadians = (validAngle - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians)),
    };
  };

  // Create SVG path for pie slice
  const createSlicePath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, endAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    
    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      `L ${centerX} ${centerY}`,
      'Z',
    ].join(' ');
  };

  const handleSliceClick = (index: number) => {
    if (interactive) {
      setSelectedSlice(selectedSlice === index ? null : index);
    }
  };

  const handleSliceHover = (index: number | null) => {
    if (interactive) {
      setHoveredSlice(index);
    }
  };

  return (
    <div className="relative">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h3>
      
      <div className="flex flex-col items-center">
        {/* SVG Chart */}
        <div className="relative">
          <svg
            width={radius * 2 + 40}
            height={radius * 2 + 40}
            className="transform -rotate-90"
          >
            {slices.map((slice, index) => {
              const isHovered = hoveredSlice === index;
              const isSelected = selectedSlice === index;
              const scale = isHovered || isSelected ? 1.05 : 1;
              const opacity = isHovered ? 0.8 : 1;
              
              return (
                <g key={index}>
                  <path
                    d={createSlicePath(slice.startAngle, slice.endAngle)}
                    fill={slice.color}
                    opacity={opacity}
                    transform={`scale(${scale})`}
                    style={{ transformOrigin: `${centerX}px ${centerY}px` }}
                    className={`transition-all duration-300 ${interactive ? 'cursor-pointer' : ''}`}
                    onClick={() => handleSliceClick(index)}
                    onMouseEnter={() => handleSliceHover(index)}
                    onMouseLeave={() => handleSliceHover(null)}
                  />
                  
                  {/* Center text for selected slice */}
                  {isSelected && (
                    <text
                      x={centerX}
                      y={centerY + 5}
                      textAnchor="middle"
                      className={`${fontSize} font-bold fill-gray-800`}
                    >
                      {slice.percentage.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          
          {/* Center label when no slice is selected */}
          {selectedSlice === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">{total}</div>
                <div className="text-sm text-gray-500">Total Responses</div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-6 space-y-2">
            {slices.map((slice, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-2 rounded-lg transition-all duration-200 ${
                  hoveredSlice === index ? 'bg-gray-100' : ''
                } ${selectedSlice === index ? 'bg-blue-50 border border-blue-200' : ''}`}
                onMouseEnter={() => handleSliceHover(index)}
                onMouseLeave={() => handleSliceHover(null)}
                onClick={() => handleSliceClick(index)}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-sm font-medium text-gray-700">
                  {slice.label}
                </span>
                <span className="text-sm font-bold text-gray-600">
                  {slice.percentage.toFixed(1)}%
                </span>
                {slice.description && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({slice.description})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
