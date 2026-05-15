'use client';

import React, { useState, useEffect } from 'react';

export default function DerivationSimulator() {
  const [targetRisk, setTargetRisk] = useState<number>(1e-5);
  const [consumptionRate, setConsumptionRate] = useState<number>(32);
  const [baf, setBaf] = useState<number>(50);
  const [calculatedStandard, setCalculatedStandard] = useState<string>('0.00');

  useEffect(() => {
    // Mock derivation formula
    const rawStandard = (targetRisk * 1e6 * 100) / (consumptionRate * baf);
    setCalculatedStandard(rawStandard.toFixed(4));
  }, [targetRisk, consumptionRate, baf]);

  // For Target Risk, we'll map powers of 10 to a linear slider (-6 to -4)
  const logRisk = Math.log10(targetRisk);
  
  const handleRiskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetRisk(Math.pow(10, parseFloat(e.target.value)));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Matrix Standard Simulator</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Interactive What-If Modeling</p>
      </div>

      <div className="bg-sky-50 dark:bg-sky-900/20 rounded-2xl p-8 text-center border border-sky-100 dark:border-sky-800 shadow-inner">
        <div className="text-sm font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider mb-2">Calculated Sediment Standard</div>
        <div className="text-5xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
          {calculatedStandard} <span className="text-2xl text-slate-500 font-medium">mg/kg</span>
        </div>
      </div>

      <div className="space-y-6 pt-4">
        {/* Target Risk Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Risk Level</label>
            <span className="text-sm font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">10^{logRisk.toFixed(1)}</span>
          </div>
          <input 
            type="range" 
            min="-6" 
            max="-4" 
            step="0.1" 
            value={logRisk} 
            onChange={handleRiskChange}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>1e-6</span>
            <span>1e-4</span>
          </div>
        </div>

        {/* Consumption Rate Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Consumption Rate</label>
            <span className="text-sm font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{consumptionRate} g/day</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="200" 
            step="1" 
            value={consumptionRate} 
            onChange={(e) => setConsumptionRate(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>10 g/d</span>
            <span>200 g/d</span>
          </div>
        </div>

        {/* BAF Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Bioaccumulation Factor (BAF)</label>
            <span className="text-sm font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{baf}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="1" 
            value={baf} 
            onChange={(e) => setBaf(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>1</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
