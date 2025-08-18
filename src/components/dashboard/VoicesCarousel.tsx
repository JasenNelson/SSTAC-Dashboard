// src/components/dashboard/VoicesCarousel.tsx
'use client';

import { useState, useEffect } from 'react';

type Quote = {
  id: number;
  text: string;
  author: string;
  background: string;
  perspective: string;
};

const quotes: Quote[] = [
  {
    id: 1,
    text: "The BC CSR sediment standards are not appropriate or adequate to protect upper trophic level organisms, apex predators and humans. We need a dual approach that addresses both benthic protection and bioaccumulation risks.",
    author: "Environmental Consultant",
    background: "Representative of widespread expert concern",
    perspective: "Environmental protection focus"
  },
  {
    id: 2,
    text: "Current standards fail to account for site-specific conditions and receptor sensitivity. A tiered framework would provide the flexibility we need while maintaining environmental protection.",
    author: "Industry Representative",
    background: "Advocating for practical implementation",
    perspective: "Industry and implementation focus"
  },
  {
    id: 3,
    text: "The expansion of regulated contaminants is essential. We're missing emerging substances that pose significant risks to aquatic ecosystems and human health.",
    author: "Government Official",
    background: "Regulatory perspective on comprehensive coverage",
    perspective: "Regulatory and policy focus"
  },
  {
    id: 4,
    text: "Bioavailability adjustments are critical for accurate risk assessment. Current standards don't reflect the complex interactions between contaminants and sediment chemistry.",
    author: "Academic Researcher",
    background: "Scientific perspective on assessment accuracy",
    perspective: "Scientific and research focus"
  },
  {
    id: 5,
    text: "We need to weave Indigenous knowledge into these standards. Our communities have observed environmental changes for generations and understand the long-term impacts on ecosystem health.",
    author: "Indigenous Knowledge Holder",
    background: "Traditional ecological knowledge perspective",
    perspective: "Indigenous knowledge and community focus"
  },
  {
    id: 6,
    text: "Modernizing these standards is about protecting not just the environment, but the communities that depend on healthy aquatic ecosystems. We need standards that reflect current science and future challenges.",
    author: "Environmental NGO Representative",
    background: "Community and environmental protection focus",
    perspective: "Community and advocacy focus"
  }
];

export default function VoicesCarousel({ quotes, autoRotate = true, rotationInterval = 8000, showNavigation = true }: any) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    }, 8000); // Change quote every 8 seconds

    return () => clearInterval(interval);
  }, []);

  const currentQuote = quotes[currentQuoteIndex];

  if (!currentQuote) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
      <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center justify-center">
        <span className="text-2xl mr-3">💬</span>
        Voices from the Field
      </h3>
      
      <div className="text-center">
        <blockquote className="text-blue-700 italic text-lg leading-relaxed mb-4 border-l-4 border-blue-300 pl-6 text-center max-w-4xl mx-auto">
          "{currentQuote.text}"
        </blockquote>
        <p className="text-blue-600 text-sm font-medium">- {currentQuote.author}</p>
        <p className="text-blue-500 text-xs text-center mt-2">{currentQuote.background}</p>
      </div>

      {/* Quote Navigation Dots */}
      <div className="flex justify-center mt-6 space-x-2">
        {quotes.map((_: any, index: number) => (
          <button
            key={index}
            onClick={() => setCurrentQuoteIndex(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentQuoteIndex
                ? 'bg-blue-600 scale-125'
                : 'bg-blue-300 hover:bg-blue-400'
            }`}
            aria-label={`Go to quote ${index + 1}`}
          />
        ))}
      </div>

      {/* Quote Counter */}
      <div className="text-center mt-4">
        <span className="text-blue-500 text-sm">
          Quote {currentQuoteIndex + 1} of {quotes.length}
        </span>
      </div>
    </div>
  );
}
