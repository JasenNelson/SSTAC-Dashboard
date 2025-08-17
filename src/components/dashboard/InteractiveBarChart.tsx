// src/components/dashboard/InteractiveBarChart.tsx
'use client';

import { useState } from 'react';

interface BarChartData {
  label: string;
  value: number;
  color: string;
  description?: string;
  maxValue?: number;
}

interface InteractiveBarChartProps {
  data: BarChartData[];
  title: string;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  showPercentages?: boolean;
  interactive?: boolean;
  maxValue?: number;
}

export default function InteractiveBarChart({
  data,
  title,
  orientation = 'horizontal',
  showValues = true,
  showPercentages = true,
  interactive = true,
  maxValue,
}: InteractiveBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  // Safety check for empty data
  if (!data || data.length === 0) {
    return (
      <div className="relative">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      </div>
    );
  }

  // Calculate max value if not provided
  const calculatedMaxValue = maxValue || Math.max(...data.map(item => item.value));
  
  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const bars = data.map((item, index) => ({
    ...item,
    percentage: (item.value / total) * 100,
    width: (item.value / calculatedMaxValue) * 100,
    index,
  }));

  const handleBarClick = (index: number) => {
    if (interactive) {
      setSelectedBar(selectedBar === index ? null : index);
    }
  };

  const handleBarHover = (index: number | null) => {
    if (interactive) {
      setHoveredBar(index);
    }
  };

  if (orientation === 'horizontal') {
    return (
      <div className="relative">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        
        <div className="space-y-3">
          {bars.map((bar, index) => {
            const isHovered = hoveredBar === index;
            const isSelected = selectedBar === index;
            
            return (
              <div
                key={index}
                className="group relative"
                onMouseEnter={() => handleBarHover(index)}
                onMouseLeave={() => handleBarHover(null)}
                onClick={() => handleBarClick(index)}
              >
                <div className="flex items-center space-x-3">
                  {/* Label */}
                  <div className="w-32 text-sm font-medium text-gray-700 text-right">
                    {bar.label}
                  </div>
                  
                  {/* Bar Container */}
                  <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden relative">
                    {/* Bar */}
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isHovered ? 'shadow-lg' : ''
                      } ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
                      style={{
                        backgroundColor: bar.color,
                        width: `${bar.width}%`,
                        transform: isHovered ? 'scaleY(1.1)' : 'scaleY(1)',
                        transformOrigin: 'left center',
                      }}
                    />
                    
                    {/* Value Label on Bar */}
                    {showValues && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-white drop-shadow-sm">
                          {bar.value}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Percentage */}
                  {showPercentages && (
                    <div className="w-20 text-sm font-semibold text-gray-600 text-right">
                      {bar.percentage.toFixed(1)}%
                    </div>
                  )}
                </div>
                
                {/* Hover Tooltip */}
                {isHovered && interactive && (
                  <div className="absolute z-10 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 pointer-events-none transform -translate-x-1/2 -translate-y-full mt-2">
                    <div className="font-semibold">{bar.label}</div>
                    <div>{bar.value} responses ({bar.percentage.toFixed(1)}%)</div>
                    {bar.description && (
                      <div className="text-gray-300 mt-1">{bar.description}</div>
                    )}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Selected Bar Details */}
        {selectedBar !== null && data[selectedBar] && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">
              {data[selectedBar].label} - Detailed Information
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div><strong>Responses:</strong> {data[selectedBar].value}</div>
              <div><strong>Percentage:</strong> {bars[selectedBar].percentage.toFixed(1)}%</div>
              {data[selectedBar].description && (
                <div><strong>Context:</strong> {data[selectedBar].description}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vertical orientation (for future use)
  return (
    <div className="relative">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="text-center text-gray-500">
        Vertical orientation not yet implemented
      </div>
    </div>
  );
}
