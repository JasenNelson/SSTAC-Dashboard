'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function WIKSClient() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  const polls: PollData[] = [
    {
      question: "What is the most effective starting point for developing a holistic baseline study that combines co-located sampling (e.g., sediment, porewater, tissue, surface water) with area-based Indigenous Knowledge and Science?",
      questionNumber: 1,
      options: [
        "A co-developed conceptual site model that uses Indigenous Knowledge to first identify key species, exposure pathways, and areas of cultural significance to guide the scientific sampling plan.",
        "A comprehensive literature and data review that compiles all existing scientific and Indigenous knowledge for the area to identify critical data gaps that the baseline study must fill.",
        "A pilot-scale field study conducted collaboratively with community members to test and validate sampling methods and ensure they are effective and culturally appropriate.",
        "A series of collaborative workshops where knowledge holders and scientists share information to establish a shared understanding of the ecosystem's history, health, and stressors."
      ]
    },
    {
      question: "How can the scientific framework incorporate protection goals related to Indigenous Stewardship principles such as the 'connectedness of all life' and '7-generations'?",
      questionNumber: 2,
      options: [
        "By using food-web models that scientifically map contaminant pathways between species.",
        "By developing Species Sensitivity Distributions (SSDs) that include culturally significant local species.",
        "By setting protective tissue residue guidelines for key indicator species to ensure long-term safety.",
        "By incorporating ecosystem function metrics (e.g., nutrient cycling) as formal scientific endpoints.",
        "By developing standards to protect the fitness of resources for various traditional uses, such as medicinal plants."
      ]
    },
    {
      question: "Within a tiered framework, where can place-based Indigenous Knowledge provide the most direct scientific value for modifying a generic baseline value to be more site-specific?",
      questionNumber: 3,
      options: [
        "Informing bioavailability models with specific knowledge of local sediment characteristics and processes.",
        "Identifying sensitive local species or life stages not included in the generic models for a more accurate risk calculation.",
        "Characterizing unique, site-specific contaminant exposure pathways that would alter baseline risk model assumptions.",
        "Identifying potential confounding environmental factors (e.g., freshwater seeps) influencing scientific measurements."
      ]
    }
  ];

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-amber-50">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')",
            filter: "brightness(0.7)"
          }}
        />
        
        {/* Content Overlay */}
        <div className="relative z-10 text-center text-white px-6 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 font-['Merriweather']">
            Weaving Indigenous Knowledges & Science
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            A Practical Discussion on Modernizing BC's Sediment Protection Framework
          </p>
          
          {/* Land Acknowledgement */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              "We acknowledge and respect the lək̓ʷəŋən (Lekwungen) Peoples (Songhees and Esquimalt Nations), 
              on whose traditional territories we gather, and whose historical relationships with this land 
              continue to this day."
            </p>
          </div>
        </div>
      </section>

      {/* Bridging Vision to Action Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            From Vision to Action: A New Approach to Stewardship
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The 'Why' */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🌊</div>
                <h3 className="text-2xl font-bold mb-4">The 'Why' - Foundational Vision</h3>
                <p className="text-blue-100 leading-relaxed">
                  Embrace 'Two-Eyed Seeing' to recognize that our waters and lands are kin. 
                  Respectfully integrating Indigenous wisdom with Western science can forge more 
                  holistic, place-based environmental standards.
                </p>
              </div>
            </div>

            {/* Card 2: The 'How' */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🏛️</div>
                <h3 className="text-2xl font-bold mb-4">The 'How' - A Tangible Example</h3>
                <p className="text-green-100 leading-relaxed">
                  The Tsleil-Waututh Nation's work on the Burrard Inlet Water Quality Objectives 
                  is a precedent-setting, Nation-led initiative. It demonstrates a successful 
                  government-to-government process that weaves knowledges to create numerical 
                  values that protect cultural practices.
                </p>
              </div>
            </div>

            {/* Card 3: The Bridge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🌉</div>
                <h3 className="text-2xl font-bold mb-4">The Bridge - Our Goal</h3>
                <p className="text-amber-100 leading-relaxed">
                  Our goal is to build on this momentum. We will explore how we can apply 
                  these principles to the scientific framework for modernizing BC's sediment standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Opportunities for Braiding Knowledges Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            Opportunities for Weaving Knowledges
          </h2>
          
          <div className="space-y-6">
            {/* Accordion 1 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('accordion-1')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Holistic Protection Approach</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'accordion-1' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'accordion-1' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">What it is:</h4>
                      <p className="text-gray-600 text-lg">
                        Protecting the entire ecosystem, including wildlife and people that rely on it.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">The IK&S Opportunity:</h4>
                      <p className="text-gray-600 text-lg">
                        Re-visioning the conceptual exposure scenarios. What does it mean to protect Indigenous Uses? 
                        How can the scientific framework include 'health' protection goals that are inclusive of the 
                        well-being of culturally significant species, such as medicinal plants, and the ability for 
                        communities to maintain their relationship with the water?
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('accordion-2')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Tiered, Site-Specific Approach</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'accordion-2' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'accordion-2' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">What it is:</h4>
                      <p className="text-gray-600 text-lg">
                        Recognizing every place is unique and developing a framework for tailoring assessments to local conditions.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">The IK&S Opportunity:</h4>
                      <p className="text-gray-600 text-lg">
                        Would a collaborative study, aimed at gathering area-based knowledge and scientific data, 
                        be a good initial step? Would a cause-effect approach (probabilistic modeling) help us 
                        understand real-world environmental conditions, including multiple stressors, cumulative 
                        effects, complex mixtures, ecosystem characteristics, and Indigenous Uses?
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 font-['Merriweather']">
            The Questions We Face
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-4xl mx-auto">
            Your insights will help inform this collaborative process. Please share your thoughts on the following questions.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // Use RankingPoll if question contains "rank"
              if (poll.question.toLowerCase().includes('rank')) {
                return (
                  <RankingPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/wiks"
                    onVote={(pollIndex, rankings) => {
                      console.log(`Ranking submitted for poll ${pollIndex}:`, rankings);
                    }}
                  />
                );
              }
              
              // Use regular PollWithResults for single-choice questions
              return (
                <PollWithResults
                  key={pollIndex}
                  pollIndex={pollIndex}
                  question={poll.question}
                  options={poll.options}
                  pagePath="/wiks"
                  questionNumber={poll.questionNumber}
                  onVote={(pollIndex, optionIndex) => {
                    console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}`);
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Next Steps & Contact Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather']">
            Thank You & Next Steps
          </h2>
          
          <div className="space-y-8 text-lg">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Your Input Matters</h3>
              <p className="text-gray-200 leading-relaxed">
                Your contributions will directly inform the SSTAC's ongoing work and help us find 
                meaningful pathways to weave these essential knowledge systems together.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Continuing the Dialogue</h3>
              <p className="text-gray-200 leading-relaxed">
                This conversation extends beyond today's session. We welcome your ongoing perspectives 
                as we develop this framework together.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Contact Information</h3>
              <p className="text-gray-200 mb-4">
                Please reach out with additional insights or questions about the Sediment Standards Project.
              </p>
              <a 
                href="mailto:info@sabcs.ca"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-300 text-lg"
              >
                Email: info@sabcs.ca
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-400">
            &copy; 2024 SSTAC & TWG Dashboard | Weaving Indigenous Knowledge & Science
          </p>
        </div>
      </footer>
    </div>
  );
}
