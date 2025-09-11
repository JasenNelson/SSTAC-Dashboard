// src/components/dashboard/SurveyResultsChart.tsx
'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useEffect, useState } from 'react';

type ChartData = {
  name: string;
  effectiveness: number;
  importance: number;
};

// Sample data based on the survey findings
const sampleData: ChartData[] = [
  {
    name: 'Current Standards',
    effectiveness: 27, // 27% find them effective
    importance: 95,   // 95% rate as important
  },
  {
    name: 'Bioaccumulation',
    effectiveness: 23, // 23% find them effective
    importance: 91,   // 91% rate as important
  },
  {
    name: 'Contaminant List',
    effectiveness: 18, // 18% find them adequate
    importance: 95,   // 95% rate expansion as essential
  },
  {
    name: 'Tiered Framework',
    effectiveness: 35, // 35% find current approach adequate
    importance: 86,   // 86% rate as important
  },
  {
    name: 'Modern Methods',
    effectiveness: 42, // 42% find current methods adequate
    importance: 89,   // 89% rate modernization as important
  }
];

export default function SurveyResultsChart() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Check on mount
    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Theme-aware colors
  const textColor = isDarkMode ? '#f3f4f6' : '#6b7280';
  const gridColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const tooltipBg = isDarkMode ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const tooltipBorder = isDarkMode ? '#4b5563' : '#d1d5db';
  const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';
  const legendText = isDarkMode ? '#d1d5db' : '#374151';

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sampleData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis 
            dataKey="name" 
            stroke={textColor} 
            fontSize={11}
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fill: textColor }}
          />
          <YAxis 
            stroke={textColor} 
            fontSize={11}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: textColor }}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '15px',
              paddingBottom: '5px',
            }}
            formatter={(value) => (
              <span style={{ 
                color: legendText, 
                fontSize: '12px',
                fontWeight: '500',
              }}>
                {value === 'effectiveness' ? 'Current Effectiveness' : 'Perceived Importance'}
              </span>
            )}
          />
          <Bar 
            dataKey="effectiveness" 
            fill="#ef4444" 
            name="effectiveness"
            radius={[3, 3, 0, 0]}
          />
          <Bar 
            dataKey="importance" 
            fill="#10b981" 
            name="importance"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}