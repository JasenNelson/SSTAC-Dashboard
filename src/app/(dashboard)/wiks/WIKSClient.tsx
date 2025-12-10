'use client';

import React, { useState } from 'react';

export default function WIKSClient() {
  const [expandedBios, setExpandedBios] = useState<{ [key: string]: boolean }>({
    waters: false,
    twn: false,
  });

  const toggleBio = (speaker: string) => {
    setExpandedBios(prev => ({
      ...prev,
      [speaker]: !prev[speaker],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-amber-50">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src="/HoweSound3.JPG?v=1" 
            alt="Howe Sound landscape for Indigenous Knowledge and Science"
            className="w-full h-full object-cover"
            style={{ filter: "brightness(0.55)" }}
          />
        </div>
        
        {/* Dark Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-black/20"></div>
        
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
              continue to this day." (Oct. 7, 2025 meeting at Canadian Ecotoxicity Workshop in Victoria)
            </p>
          </div>
        </div>
      </section>

      {/* Bridging Vision to Action Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            From Vision to Action: A New Approach to Stewardship
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Card 1: The 'Why' */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🌊</div>
                <h3 className="text-2xl font-bold mb-4">The 'Why' - Foundational Vision</h3>
                <p className="text-blue-100 leading-relaxed">
                  Embrace 'Two-Eyed Seeing' to move beyond conventional environmental management by braiding the deep, relational wisdom of Indigenous Knowledge and Science with Western science. This approach seeks to develop more holistic, place-based standards that are not only scientifically robust but also culturally relevant and respectful.
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
          </div>
        </div>
      </section>

      {/* Panel Speakers Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 font-['Merriweather']">
            Panel Speakers
          </h2>
          <p className="text-center text-gray-700 dark:text-gray-300 text-lg mb-4 max-w-4xl mx-auto">
            Our panel discussion featured three distinguished speakers who shared their expertise on weaving Indigenous Knowledges with Western science
          </p>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-12 max-w-4xl mx-auto italic">
            Click to expand each speaker&apos;s card to view their presentation abstract
          </p>
          
          <div className="space-y-6">
            {/* Dr. Shannon Waters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
              <button
                onClick={() => toggleBio('waters')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    Dr. Shannon Waters
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 font-semibold">
                    Member of the Stz&apos;uminus First Nation; Deputy Provincial Health Officer (PHO) in BC for Water and Planetary Health
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    Office of the Provincial Health Officer
                  </p>
                </div>
                <div className="ml-4 text-2xl text-gray-600 dark:text-gray-400">
                  {expandedBios.waters ? '−' : '+'}
                </div>
              </button>
              {expandedBios.waters && (
                <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6 space-y-4 text-gray-700 dark:text-gray-300">
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Presentation Abstract:
                    </p>
                    <p className="italic text-lg mb-4">
                      Weaving knowledges: Indigenous wisdom in modernizing sediment standards for planetary health.
                    </p>
                    <p>
                      Our waters, lands, and sediments are not mere resources; they are kin, fundamental to the health of all beings. The approaches to developing environmental criteria, including those for sediment quality, have been viewed primarily through a Western scientific lens. This perspective misses the deep, relational understanding inherent in Indigenous Knowledges – wisdom cultivated over millennia of direct observation and stewardship. As Deputy Provincial Health Officer for Planetary and Water Health, and as a member of the Stz&apos;uminus First Nation, I see an urgent need and profound opportunity to embrace &quot;Two-Eyed Seeing.&quot;
                    </p>
                    <p>
                      This presentation will explore the critical importance of integrating Indigenous Knowledges into the modernization of sediment standards. We will discuss how Indigenous perspectives on the interconnectedness of all living things, the spiritual significance of water, and the identification of culturally vital species and sites can enrich and expand our definitions of a healthy, protected environment. By braiding ancient and &quot;younger&quot; scientific methods, we can move beyond purely numerical benchmarks towards more holistic, place-based standards. This approach will strengthen ecosystem protection for the beings, including humans, who comprise them. Such approaches are now also required to uphold the principals of BC&apos;s Declaration on the Rights of Indigenous Peoples Act.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Anuradha Rao & Melany Sanchez Solano - Co-Presenters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
              <button
                onClick={() => toggleBio('twn')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                    Anuradha Rao & Melany Sanchez Solano
                  </h3>
                  <div className="space-y-1">
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">
                      Anuradha Rao: Senior Marine Ecosystem Specialist
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">
                      Melany Sanchez Solano: Referrals Analyst
                    </p>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    Tsleil-Waututh Nation
                  </p>
                </div>
                <div className="ml-4 text-2xl text-gray-600 dark:text-gray-400">
                  {expandedBios.twn ? '−' : '+'}
                </div>
              </button>
              {expandedBios.twn && (
                <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6 space-y-4 text-gray-700 dark:text-gray-300">
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Presentation Abstract:
                    </p>
                    <p className="italic text-lg mb-4">
                      Setting a New Standard: Merging Western and Indigenous Science to Apply the Burrard Inlet Water Quality Objectives to Contaminated Sites.
                    </p>
                    <p>
                      səlilwət (Burrard Inlet) is at the core of Tsleil-Waututh Nation (TWN) unceded traditional territory. Tsleil-Waututh have used, occupied, and governed səlilwət according to Coast Salish protocol since time immemorial. Adverse effects of colonial settlement, urban, industrial, and port development have eroded the ecological health, integrity, and diversity of səlilwət and are preventing Tsleil-Waututh from practicing their ways of life. Tsleil-Waututh Nation has a goal to restore the health of the Inlet so the community can once again utilize the waters and beaches of səlilwət for traditional food harvesting and other cultural practices.
                    </p>
                    <p>
                      TWN&apos;s Burrard Inlet Action Plan is a founding guidance document to improve the health of səlilwət. Updating the Burrard Inlet Water Quality Objectives (WQOs) is the first identified priority. The updated Burrard Inlet WQOs are co-signed by the Province of BC and TWN, representing a first of its kind Government-to-Government initiative that weaves together Indigenous and western science. WQOs are numbers or statements that represent safe levels of substances in waterbodies. They inform resource management decisions and promote the stewardship of water resources in BC.
                    </p>
                    <p>
                      Contamination in səlilwət has long surpassed what is allowable under Tsleil-Waututh law. TWN&apos;s basin-wide data analysis and visualization demonstrate that ~700 contaminants have been detected in səlilwət, entering from multiple sources, and potentially from the ~4600 contaminated sites in its catchment area. The work to implement and attain the WQOs requires collective effort. We have an opportunity to reframe contaminated sites management to help attain the WQOs and restore water values.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Panel Questions Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 font-['Merriweather'] panel-questions-heading">
            Panel Discussion
          </h2>
          <p className="text-center text-gray-700 dark:text-gray-300 text-lg mb-4 max-w-4xl mx-auto">
            Following two excellent presentations, our guest speakers shared their valuable experiences and perspectives in a panel discussion
          </p>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="space-y-8">
              {/* Question 1: Legal Status */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">On the Legal Status of Water Quality Objectives</h3>
                <p className="text-gray-900 dark:text-gray-300 text-lg mb-4 font-semibold">
                  <span className="text-gray-900 dark:text-blue-300">Audience Question:</span> What are your concerns regarding the fact that the Burrard Inlet Water Quality Objectives are not legally binding?
                </p>
                <div className="mt-4 space-y-3 text-gray-900 dark:text-gray-300">
                  <p>
                    <span className="font-semibold">Dr. Shannon Waters:</span> Dr. Shannon Waters clarified that the Water Quality Objectives <strong>are binding in Tsleil-Waututh Nation (TWN) law</strong>, which describes how to live and protect the environment as part of daily life. She contrasted this with colonial law, which she described as &quot;catch guards&quot; rather than daily instructions for living. She stressed that Indigenous law was entrenched into everyday interactions with land, soil, and water.
                  </p>
                  <p>
                    <span className="font-semibold">Anu Rao:</span> Anu Rao added that TWN is actively developing policy on how to &quot;mesh colonial and TWN law&quot; for work in the Inlet. She noted that streams of implementation include working within existing regulatory regimes, such as wastewater regulations, and finding opportunities that resonate with institutions.
                  </p>
                </div>
              </div>

              {/* Question 2: Reflecting Indigenous Values */}
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">On Reflecting Indigenous Values in Standards</h3>
                <p className="text-gray-900 dark:text-gray-300 text-lg mb-4 font-semibold">
                  <span className="text-gray-900 dark:text-green-300">Moderator Question:</span> What&apos;s one key way sediment standards could better reflect Indigenous values, cultural uses, or community health needs?
                </p>
                <div className="mt-4 text-gray-900 dark:text-gray-300">
                  <p>
                    <span className="font-semibold">Panel Response:</span> The panel emphasized treating the environment as a <strong>food source for future generations</strong>. Communities should be able to safely and abundantly eat foods and drink water. This requires a shift in thinking toward &quot;net environmental gain&quot; and a goal of <strong>&quot;No new inputs of contamination into Mother Earth&quot;</strong>. Dr. Waters also added that beyond the value of food, the Inlet holds a spiritual connection, describing it as &quot;the grandmother.&quot; The issue of historic contamination was raised, as was the challenge of remediation in an already heavily contaminated system. The panel warned of shifting baseline syndrome and stressed that restoration may take generations.
                  </p>
                </div>
              </div>

              {/* Question 3: Challenges */}
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">On Challenges of Braiding Knowledge</h3>
                <p className="text-gray-900 dark:text-gray-300 text-lg mb-4 font-semibold">
                  <span className="text-gray-900 dark:text-purple-300">Moderator Question:</span> From your experience, what&apos;s a key lesson—or challenge—you&apos;ve faced when bringing Indigenous knowledge into Western scientific processes?
                </p>
                <div className="mt-4 text-gray-900 dark:text-gray-300">
                  <p>
                    <span className="font-semibold">Dr. Waters:</span> Dr. Waters noted a key challenge is moving beyond component-based protection (e.g., pipes, source water) to a <strong>&quot;holistic watershed level&quot;</strong> perspective, which is inherent in Indigenous Knowledge systems.
                  </p>
                </div>
              </div>

              {/* Final Thoughts */}
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Final Thoughts: Landscape = Kin</h3>
                <div className="mt-4 text-gray-900 dark:text-gray-300 space-y-3">
                  <p>
                    The panel&apos;s final thoughts centered on the foundational concept that in many First Nations languages, <strong>&quot;Landscape = Kin&quot;</strong>. This perspective reframes environmental protection: &quot;How we care about the environment should be how we care about our family&quot;.
                  </p>
                  <p>
                    Speakers reinforced this by comparing care for the land and water to caring for an ill family member. They also highlighted the role of language as a framing tool, noting that land is language – not an analogy but a lived reality. The existence of dozens of words for land, water, and invertebrates reflects this continuum, and even the sounds of words (like the sound of a river running low) can teach us how to relate to the environment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Next Steps & Contact Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather']">
            Thank You & Next Steps
          </h2>
          
          <div className="space-y-8 text-lg">
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
