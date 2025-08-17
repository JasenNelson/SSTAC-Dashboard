// src/components/dashboard/SurveyResultsChart.tsx
'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sampleData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280" 
            fontSize={11}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={11}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              color: '#1f2937',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [
              `${value}%`, 
              name === 'effectiveness' ? 'Current Effectiveness' : 'Perceived Importance'
            ]}
            labelStyle={{ 
              fontWeight: 'bold',
              color: '#1f2937',
              fontSize: '13px',
            }}
            itemStyle={{
              color: '#1f2937',
              fontSize: '12px',
            }}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '15px',
              paddingBottom: '5px',
            }}
            formatter={(value) => (
              <span style={{ 
                color: '#374151', 
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