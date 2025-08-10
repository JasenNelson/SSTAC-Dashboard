// pages/cew-2025.tsx

import type { InferGetStaticPropsType, NextPage } from 'next';
import Head from 'next/head';

// Define the shape of the data
type CewSessionData = {
  title: string;
  coChairs: string[];
  summary: string;
};

// 1. getStaticProps runs at build time on the server.
// The props it returns are passed to the page component.
export const getStaticProps = async () => {
  const sessionData: CewSessionData = {
    title: 'Holistic Protection of Aquatic Ecosystems - Modern Sediment Quality Assessment',
    coChairs: ['Jasen Nelson', 'Shannon Bard', 'Marc Cameron'],
    summary:
      'This session explores the holistic protection of aquatic ecosystems through modern sediment quality assessment. Our guest speakers will lead interactive discussions covering widespread contamination challenges, the latest in assessment science, and the critical importance of weaving Indigenous Knowledges into environmental monitoring and protection frameworks.',
  };

  return {
    props: {
      sessionData,
    },
  };
};

// 2. The page component receives the props from getStaticProps.
// It is pre-rendered into a static HTML file at build time.
const Cew2025Page: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  sessionData,
}) => {
  return (
    <>
      <Head>
        <title>CEW 2025 Session: Sediment Quality Assessment</title>
        <meta name="description" content={sessionData.summary} />
      </Head>

      <main className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
            
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 leading-tight">
              {sessionData.title}
            </h1>
            
            <p className="text-lg text-gray-600 mb-6">
              A session at the Canadian Ecotoxicity Workshop (CEW) 2025
            </p>
            
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-700 mb-3">Co-Chairs</h2>
              <div className="flex flex-wrap gap-4">
                {sessionData.coChairs.map((chair) => (
                  <span key={chair} className="bg-blue-100 text-blue-800 text-md font-medium px-4 py-2 rounded-full">
                    {chair}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-3">Session Summary</h2>
              <p className="text-gray-700 leading-relaxed text-justify">
                {sessionData.summary}
              </p>
            </div>
            
          </div>
        </div>
      </main>
    </>
  );
};

export default Cew2025Page;