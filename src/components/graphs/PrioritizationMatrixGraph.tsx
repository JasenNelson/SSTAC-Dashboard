// src/components/graphs/PrioritizationMatrixGraph.tsx
'use client';

import { useEffect, useState } from 'react';

interface GraphProps {
  title: string;
  avgImportance: number; // Correctly inverted scale 1-5
  avgFeasibility: number; // Correctly inverted scale 1-5
  responses: number;
}

export default function PrioritizationMatrixGraph({ title, avgImportance, avgFeasibility, responses }: GraphProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Convert scores (1-5) to coordinates within the safe plotting area for landscape
  // Safe area: 120-680 pixels (560px range) to avoid edges and axis overlap
  const safeX = 120 + ((avgFeasibility - 1) / 4) * 560; // 120 to 680
  const safeY = 120 + ((5 - avgImportance) / 4) * 280;   // 120 to 400 (inverted for importance)

  // Color scheme based on theme
  const colors = {
    background: isDarkMode ? '#1f2937' : 'white',
    axis: isDarkMode ? '#ffffff' : '#000000',
    text: isDarkMode ? '#ffffff' : '#374151',
    textSecondary: isDarkMode ? '#d1d5db' : '#6b7280',
    highPriority: '#059669', // Green stays the same
    noGo: '#dc2626', // Red stays the same
    dataPoint: '#2563eb' // Blue stays the same
  };

  return (
    <div className="p-3 border rounded-lg shadow-md bg-white dark:bg-gray-800">
      <h3 className="text-base font-semibold text-center mb-2 h-10 flex items-center justify-center text-gray-900 dark:text-white">{title}</h3>
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <svg
          className="w-full h-full rounded-md"
          viewBox="0 0 800 450"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="800" height="450" fill={colors.background} />
          
          {/* Solid axis lines - positioned to avoid text overlap */}
          <line x1="100" y1="50" x2="100" y2="400" stroke={colors.axis} strokeWidth="4" />
          <line x1="100" y1="400" x2="700" y2="400" stroke={colors.axis} strokeWidth="4" />
          
          {/* Dashed quadrant dividers */}
          <line x1="400" y1="50" x2="400" y2="400" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          <line x1="100" y1="225" x2="700" y2="225" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Y-axis label (Importance) */}
          <text
            x="50"
            y="225"
            textAnchor="middle"
            dominantBaseline="middle"
            transform="rotate(-90 50 225)"
            fill={colors.axis}
            fontSize="20"
            fontWeight="bold"
          >
            Important
          </text>
          <polygon points="40,60 60,60 50,40" fill={colors.axis} />
          
          {/* X-axis label (Feasible) */}
          <text 
            x="400" 
            y="430" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill={colors.axis} 
            fontSize="20" 
            fontWeight="bold"
          >
            Feasible
          </text>
          <polygon points="680,420 680,440 700,430" fill={colors.axis} />
          
          {/* Quadrant labels - positioned to avoid axis overlap with text wrapping */}
          {/* Top-Left: LONGER-TERM */}
          <text x="250" y="100" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            LONGER-TERM
          </text>
          <text x="250" y="125" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Very important but not
          </text>
          <text x="250" y="140" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently feasible
          </text>
          
          {/* Top-Right: HIGH PRIORITY NEAR-TERM */}
          <text x="550" y="95" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="18" fontWeight="bold">
            HIGH PRIORITY
          </text>
          <text x="550" y="115" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="18" fontWeight="bold">
            NEAR-TERM
          </text>
          <text x="550" y="140" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="14">
            Very important and
          </text>
          <text x="550" y="155" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="14">
            feasible now
          </text>
          
          {/* Bottom-Left: NO GO */}
          <text x="250" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="18" fontWeight="bold">
            NO GO
          </text>
          <text x="250" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            Not currently important
          </text>
          <text x="250" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            or feasible
          </text>
          
          {/* Bottom-Right: POSSIBLY LATER? */}
          <text x="550" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            POSSIBLY LATER?
          </text>
          <text x="550" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Highly feasible but not
          </text>
          <text x="550" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently important
          </text>
          
          {/* Data point - positioned in safe area */}
          {responses > 0 && (
            <circle 
              cx={safeX} 
              cy={safeY} 
              r="12" 
              fill={colors.dataPoint} 
              stroke={isDarkMode ? '#1f2937' : 'white'} 
              strokeWidth="4"
            >
              <title>{`Avg. Importance: ${avgImportance.toFixed(2)}, Avg. Feasibility: ${avgFeasibility.toFixed(2)}`}</title>
            </circle>
          )}
        </svg>
      </div>
      <p className="text-center mt-2 text-base text-gray-600 dark:text-gray-300">
        Based on {responses} paired response(s).
      </p>
    </div>
  );
}
