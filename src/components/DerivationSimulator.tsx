'use client';

import React, { useState, useEffect } from 'react';

type Pathway = 'EqP' | 'BSAF' | 'HumanHealth';

export default function DerivationSimulator() {
  // Global Controls
  const [substance, setSubstance] = useState<string>('Benzo[a]pyrene');
  const [jurisdiction, setJurisdiction] = useState<string>('BC Status Quo');
  
  // Pathway State
  const [activePathway, setActivePathway] = useState<Pathway>('HumanHealth');

  // EqP State
  const [toc, setToc] = useState<number>(1.0); // 0.1 to 10%
  
  // BSAF State
  const [lipidFraction, setLipidFraction] = useState<number>(5.0); // 1 to 15%
  const [bsafModifier, setBsafModifier] = useState<number>(1.5); // 0.1 to 5.0

  // Human Health State
  const [consumptionRate, setConsumptionRate] = useState<number>(32); // 10 to 200 g/day
  const [targetRisk, setTargetRisk] = useState<number>(1e-5); // 1e-6 to 1e-4

  // Output
  const [calculatedStandard, setCalculatedStandard] = useState<string>('0.00');

  useEffect(() => {
    let rawStandard = 0;

    // Base standard modifier based on substance
    const substanceMod = substance === 'Benzo[a]pyrene' ? 0.05 :
                         substance === 'Total PCBs' ? 0.1 : 15.0; // Copper

    if (activePathway === 'EqP') {
      // Mock EqP math: proportional to TOC
      rawStandard = substanceMod * toc * 10;
    } else if (activePathway === 'BSAF') {
      // Mock BSAF math: inversely proportional to lipid fraction and bsaf modifier.
      // Denominator guard - slider mins keep this >0, but defend against any
      // future input source that could feed 0/NaN.
      const denom = lipidFraction * bsafModifier;
      rawStandard = denom > 0 ? (substanceMod * 100) / denom : 0;
    } else if (activePathway === 'HumanHealth') {
      // Mock HH math
      rawStandard = consumptionRate > 0
        ? (targetRisk * 1e6 * 100 * substanceMod) / consumptionRate
        : 0;
    }

    setCalculatedStandard(Number.isFinite(rawStandard) ? rawStandard.toFixed(4) : '0.0000');
  }, [activePathway, substance, toc, lipidFraction, bsafModifier, consumptionRate, targetRisk]);

  const logRisk = targetRisk > 0 ? Math.log10(targetRisk) : -6;
  const handleRiskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!Number.isFinite(parsed)) return;
    const next = Math.pow(10, parsed);
    if (Number.isFinite(next) && next > 0) setTargetRisk(next);
  };

  const handleSliderNumber = (
    setter: (n: number) => void,
    fallback: number,
    parser: (v: string) => number = parseFloat,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parser(e.target.value);
    setter(Number.isFinite(parsed) ? parsed : fallback);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
      {/* Left Sidebar: Global Controls */}
      <div className="w-full md:w-1/3 space-y-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-6 md:pb-0 md:pr-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-4">Global Parameters</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Substance</label>
              <select 
                value={substance}
                onChange={(e) => setSubstance(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="Benzo[a]pyrene">Benzo[a]pyrene</option>
                <option value="Total PCBs">Total PCBs</option>
                <option value="Copper">Copper</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reference Jurisdiction</label>
              <select 
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="BC Status Quo">BC Status Quo</option>
                <option value="US EPA">US EPA</option>
                <option value="CCME">CCME</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Pathway Toggle & Dynamic Inputs */}
      <div className="w-full md:w-2/3 flex flex-col space-y-6">
        {/* Hero Metric */}
        <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner">
          <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">Calculated Matrix Standard</div>
          <div className="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
            {calculatedStandard} <span className="text-xl text-slate-500 font-medium">mg/kg</span>
          </div>
        </div>

        {/* Pathway Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {(['EqP', 'BSAF', 'HumanHealth'] as Pathway[]).map((pathway) => (
            <button
              key={pathway}
              onClick={() => setActivePathway(pathway)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                activePathway === pathway
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {pathway === 'EqP' ? 'Ecological (EqP)' : pathway === 'BSAF' ? 'Ecological (BSAF)' : 'Human Health'}
            </button>
          ))}
        </div>

        {/* Dynamic Inputs */}
        <div className="space-y-6 pt-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-800/80">
          
          {activePathway === 'EqP' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Organic Carbon (TOC)</label>
                <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">{toc.toFixed(1)} %</span>
              </div>
              <input
                type="range" min="0.1" max="10" step="0.1" value={toc}
                onChange={handleSliderNumber(setToc, 1.0)}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0.1%</span><span>10%</span></div>
            </div>
          )}

          {activePathway === 'BSAF' && (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Lipid Fraction</label>
                  <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">{lipidFraction.toFixed(1)} %</span>
                </div>
                <input
                  type="range" min="1" max="15" step="0.1" value={lipidFraction}
                  onChange={handleSliderNumber(setLipidFraction, 5.0)}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1%</span><span>15%</span></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">BSAF Modifier</label>
                  <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">{bsafModifier.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.1" max="5" step="0.1" value={bsafModifier}
                  onChange={handleSliderNumber(setBsafModifier, 1.5)}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0.1</span><span>5.0</span></div>
              </div>
            </>
          )}

          {activePathway === 'HumanHealth' && (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Risk Level</label>
                  <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">10^{logRisk.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="-6" max="-4" step="0.1" value={logRisk} 
                  onChange={handleRiskChange}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1e-6</span><span>1e-4</span></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Fish Consumption Rate</label>
                  <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">{consumptionRate} g/day</span>
                </div>
                <input
                  type="range" min="10" max="200" step="1" value={consumptionRate}
                  onChange={handleSliderNumber(setConsumptionRate, 32, (v) => parseInt(v, 10))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>10 g/d</span><span>200 g/d</span></div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
