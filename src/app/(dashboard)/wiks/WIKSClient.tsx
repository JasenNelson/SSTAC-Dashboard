'use client';

import React, { useState } from 'react';

export default function WIKSClient() {
  const [activeSection, setActiveSection] = useState('overview');

  // Handle smooth scrolling to sections
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Toggle card details
  const toggleDetails = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.toggle('hidden');
    }
  };

  // Toggle accordion content
  const toggleAccordion = (id: string) => {
    const content = document.getElementById(id);
    const button = document.querySelector(`[data-target="${id}"]`);
    const arrow = button?.querySelector('.arrow');
    
    if (content && button && arrow) {
      content.classList.toggle('hidden');
      arrow.classList.toggle('rotate-180');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#5D4037]">

      
      {/* Header & Navigation */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-[#A0522D]">WQCIU Integration Strategy</h1>
          <div className="hidden md:flex space-x-8">
            {[
              { id: 'overview', label: 'Framework Overview' },
              { id: 'comparison', label: 'Comparative Analysis' },
              { id: 'integration', label: 'BC Integration' },
              { id: 'roadmap', label: 'Roadmap' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`nav-link font-medium pb-1 transition-colors duration-300 border-b-2 ${
                  activeSection === id 
                    ? 'text-[#008080] border-[#008080]' 
                    : 'text-[#5D4037] border-transparent hover:text-[#008080] hover:border-[#008080]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="md:hidden focus:outline-none">
            <span className="block w-6 h-0.5 bg-[#5D4037] mb-1"></span>
            <span className="block w-6 h-0.5 bg-[#5D4037] mb-1"></span>
            <span className="block w-6 h-0.5 bg-[#5D4037]"></span>
          </button>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-8 md:py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-[#A0522D] mb-4">
            A New Paradigm for Water Protection
          </h2>
          <p className="max-w-3xl mx-auto text-lg text-[#5D4037]">
            An interactive exploration of the strategic plan to integrate the Indigenous-led WQCIU framework into British Columbia's modernized sediment standards, enhancing scientific and cultural relevance.
          </p>
        </section>

        {/* Section 1: Framework Overview */}
        <section id="overview" className="mb-20 pt-16">
          <h3 className="text-3xl font-bold text-center mb-2 text-[#CC7722]">
            WQCIU Framework Overview
          </h3>
          <p className="text-center max-w-2xl mx-auto mb-12">
            The WQCIU report introduces a groundbreaking dual-approach methodology, blending scientific data with Indigenous knowledge to define what needs protection and why. Click on the cards below to explore these core concepts.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Card 1: Dual-Approach Methodology */}
            <div 
              className="card bg-white p-6 rounded-lg shadow-md cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-lg"
              onClick={() => toggleDetails('details-methodology')}
            >
              <h4 className="text-xl font-bold mb-3 text-[#008080]">
                The Dual-Approach Methodology
              </h4>
              <p className="mb-4">
                The framework's core innovation is its use of two complementary lenses to define environmental criteria.
              </p>
              <div id="details-methodology" className="hidden space-y-4 mt-4 border-t pt-4">
                <div>
                  <h5 className="font-semibold text-lg">1. Current Condition Approach</h5>
                  <p>
                    An anti-degradation tool using long-term monitoring data to establish a baseline. It prevents further deterioration of water and sediment quality, even if conditions are already considered degraded from a historical perspective.
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-lg">2. Risk-Based Approach</h5>
                  <p>
                    Defines health-protective criteria by identifying risks to specific cultural practices and ecosystem components. It uses community-specific data (e.g., traditional food consumption) to ensure standards are truly protective.
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-[#008080] mt-4 inline-block">
                Click to expand
              </span>
            </div>

            {/* Card 2: Indigenous Use & Protection Goals */}
            <div 
              className="card bg-white p-6 rounded-lg shadow-md cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-lg"
              onClick={() => toggleDetails('details-goals')}
            >
              <h4 className="text-xl font-bold mb-3 text-[#008080]">
                Indigenous Use & Protection Goals
              </h4>
              <p className="mb-4">
                The framework is built on four core Indigenous water use categories defined by the partner First Nations.
              </p>
              <div id="details-goals" className="hidden space-y-3 mt-4 border-t pt-4">
                <p>
                  <strong className="text-[#A0522D]">Traditional Foods & Drinking Water:</strong> Ensures safe consumption of fish, wildlife, and untreated water.
                </p>
                <p>
                  <strong className="text-[#A0522D]">Traditional Medicines:</strong> Protects aquatic plants like wild mint and rat root from contamination.
                </p>
                <p>
                  <strong className="text-[#A0522D]">Aquatic Ecosystem Health:</strong> A holistic view protecting the entire ecosystem for community well-being.
                </p>
                <p>
                  <strong className="text-[#A0522D]">Wildlife Health:</strong> Protects not just animal survival, but their fitness for cultural use (e.g., "Good quality pelts").
                </p>
              </div>
              <span className="text-sm font-medium text-[#008080] mt-4 inline-block">
                Click to expand
              </span>
            </div>
          </div>
        </section>

        {/* Section 2: Comparative Analysis */}
        <section id="comparison" className="mb-20 pt-16 bg-[#EFEBE9] -mx-6 px-6 py-12 rounded-lg">
          <h3 className="text-3xl font-bold text-center mb-2 text-[#CC7722]">
            Comparative Analysis
          </h3>
          <p className="text-center max-w-2xl mx-auto mb-12">
            The WQCIU's methods lead to significantly different outcomes compared to standard approaches. The chart below highlights the dramatic difference in fish consumption rates used for risk assessment—a key driver for more protective standards.
          </p>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h4 className="text-xl font-bold text-center mb-6">
              Fish Consumption Rate Comparison (g/day)
            </h4>
            <div className="relative w-full max-w-2xl mx-auto h-80">
              <div className="flex items-center justify-center h-full">
                <div className="grid grid-cols-2 gap-8 w-full">
                  <div className="text-center">
                    <div className="bg-[#CC7722] text-white p-4 rounded-lg mb-2">
                      <div className="text-3xl font-bold">22</div>
                      <div className="text-sm">g/day</div>
                    </div>
                    <div className="font-semibold text-[#5D4037]">US EPA Default</div>
                  </div>
                  <div className="text-center">
                    <div className="bg-[#008080] text-white p-4 rounded-lg mb-2">
                      <div className="text-3xl font-bold">388</div>
                      <div className="text-sm">g/day</div>
                    </div>
                    <div className="font-semibold text-[#5D4037]">WQCIU (95th Percentile)</div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-4 text-sm text-[#5D4037]">
                <strong>17.6x higher</strong> consumption rate leads to significantly more protective standards
              </div>
            </div>
          </div>
        </section>
        
        {/* Section 3: BC Integration Strategy */}
        <section id="integration" className="mb-20 pt-16">
          <h3 className="text-3xl font-bold text-center mb-2 text-[#CC7722]">
            BC Integration Strategy
          </h3>
          <p className="text-center max-w-2xl mx-auto mb-12">
            The strategic plan proposes weaving WQCIU principles into the fabric of BC's modernized standards. This involves enhancing guiding principles, aligning methodologies, and adopting a true co-development model.
          </p>
          
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h4 className="text-2xl font-bold text-center mb-8">A Path to Integration</h4>
            <div className="relative flex flex-col items-center md:flex-row justify-around space-y-8 md:space-y-0">
              {/* WQCIU Principles */}
              <div className="text-center w-64 p-4 border-2 border-[#008080] rounded-lg">
                <h5 className="font-bold text-lg text-[#008080]">WQCIU Principles</h5>
                <ul className="text-left mt-2 list-disc list-inside text-sm space-y-1">
                  <li>Community-Defined Goals</li>
                  <li>Community-Led Data</li>
                  <li>Dual-Approach Method</li>
                  <li>Co-Developed Framework</li>
                </ul>
              </div>
              
              {/* Arrow */}
              <div className="text-4xl text-[#A0522D] font-bold transform md:-translate-y-1/2 md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 rotate-90 md:rotate-0">
                →
              </div>

              {/* BC Framework Enhancements */}
              <div className="text-center w-64 p-4 border-2 border-[#008080] rounded-lg">
                <h5 className="font-bold text-lg text-[#008080]">Proposed BC Enhancements</h5>
                <ul className="text-left mt-2 list-disc list-inside text-sm space-y-1">
                  <li>Protect Traditional Use</li>
                  <li>Uphold Co-Governance</li>
                  <li>Adopt Anti-Degradation</li>
                  <li>Launch BC Consumption Surveys</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="italic">This integration transforms BC's standards into a tool for protecting cultural practices, not just species.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Implementation Roadmap */}
        <section id="roadmap" className="pt-16 bg-[#EFEBE9] -mx-6 px-6 py-12 rounded-lg">
          <h3 className="text-3xl font-bold text-center mb-2 text-[#CC7722]">
            Implementation Roadmap
          </h3>
          <p className="text-center max-w-2xl mx-auto mb-12">
            The path forward involves adopting best practices while proactively addressing challenges. Explore the key steps and proposed solutions below.
          </p>
          
          <div className="max-w-4xl mx-auto">
            {/* Accordion Item 1: Best Practices */}
            <div className="mb-4 border border-gray-200 rounded-lg bg-white">
              <button 
                className="w-full text-left p-4 font-semibold text-lg text-[#008080] flex justify-between items-center"
                onClick={() => toggleAccordion('accordion-1')}
                data-target="accordion-1"
              >
                <span>Key Learnings & Best Practices</span>
                <span className="arrow transform transition-transform duration-300">▼</span>
              </button>
              <div id="accordion-1" className="hidden p-4 border-t">
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <strong>Knowledge Integration:</strong> Treat Indigenous knowledge as a primary source of quantitative data and guiding principles.
                  </li>
                  <li>
                    <strong>Community-Led Data Collection:</strong> Empower communities to lead data gathering to ensure cultural appropriateness, accuracy, and trust.
                  </li>
                  <li>
                    <strong>Conservatism in Protection:</strong> Use precautionary principles (e.g., 95th percentile consumption rates) to protect the most exposed individuals.
                  </li>
                </ul>
              </div>
            </div>

            {/* Accordion Item 2: Challenges & Solutions */}
            <div className="mb-4 border border-gray-200 rounded-lg bg-white">
              <button 
                className="w-full text-left p-4 font-semibold text-lg text-[#008080] flex justify-between items-center"
                onClick={() => toggleAccordion('accordion-2')}
                data-target="accordion-2"
              >
                <span>Anticipated Challenges & Solutions</span>
                <span className="arrow transform transition-transform duration-300">▼</span>
              </button>
              <div id="accordion-2" className="hidden p-4 border-t">
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold">Challenge: Diversity of Nations and Diets in BC</h5>
                    <p>A single, province-wide consumption rate is inappropriate for over 200 distinct First Nations.</p>
                    <p className="mt-1">
                      <strong className="text-[#A0522D]">Solution:</strong> Implement a regional approach, developing a suite of eco-cultural region-specific standards based on local surveys.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-semibold">Challenge: Data Gaps for BC-Specific Species</h5>
                    <p>Bioaccumulation factors (BAFs) may not exist for all culturally important species.</p>
                    <p className="mt-1">
                      <strong className="text-[#A0522D]">Solution:</strong> Commit to funding targeted, collaborative research with First Nations and academic partners to fill these critical data gaps.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Accordion Item 3: Concluding Recommendation */}
            <div className="border border-gray-200 rounded-lg bg-white">
              <button 
                className="w-full text-left p-4 font-semibold text-lg text-[#008080] flex justify-between items-center"
                onClick={() => toggleAccordion('accordion-3')}
                data-target="accordion-3"
              >
                <span>Concluding Recommendation</span>
                <span className="arrow transform transition-transform duration-300">▼</span>
              </button>
              <div id="accordion-3" className="hidden p-4 border-t">
                <p>
                  Fully embrace the WQCIU principles to create modernized sediment standards that are scientifically robust, holistically protective, and a leading Canadian example of environmental co-governance. This approach strengthens legal defensibility and represents a tangible step toward reconciliation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#5D4037] text-white mt-16">
        <div className="container mx-auto px-6 py-4 text-center">
          <p>&copy; 2024 SSTAC & TWG Dashboard | Weaving Indigenous Knowledge & Science</p>
        </div>
      </footer>
    </div>
  );
}
