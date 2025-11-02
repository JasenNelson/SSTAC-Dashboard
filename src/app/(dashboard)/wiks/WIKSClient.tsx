'use client';

import React from 'react';

export default function WIKSClient() {

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
              continue to this day."
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
          </div>
        </div>
      </section>

      {/* Panel Questions Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 font-['Merriweather'] panel-questions-heading">
            Panel Questions
          </h2>
          <p className="text-center text-gray-700 dark:text-gray-300 text-lg mb-4 max-w-4xl mx-auto">
            Following two excellent presentations, our guest speakers shared their valuable experiences and perspectives on the following panel questions
          </p>
          <p className="text-center text-gray-600 dark:text-gray-400 text-base italic mb-16 max-w-4xl mx-auto">
            Note: Responses from panel will be added soon
          </p>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="space-y-8">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Question 1</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  What&apos;s one key way sediment standards could better reflect Indigenous values, cultural uses, or community health needs?
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Question 2</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  From your experience, what&apos;s a key lesson—or challenge—you&apos;ve faced when bringing Indigenous knowledge into Western scientific processes?
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Question 3</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Can you share an example of Two-Eyed Seeing in action and what it revealed about combining Indigenous and Western approaches?
                </p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Question 4</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Where do you see current sediment standards falling short in protecting land, water, and communities from an Indigenous viewpoint?
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Question 5</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  How would treating land and water as kin—rather than resources—change how we define and enforce environmental standards?
                </p>
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
