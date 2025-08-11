// pages/survey-results.tsx
// Forcing a new deployment on Vercel
import type { InferGetStaticPropsType, NextPage } from 'next';
import Head from 'next/head';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Define the shape of our chart data
type ChartData = {
  name: string;
  interest: number;
};

// 1. getStaticProps runs at build time to fetch or generate data.
export const getStaticProps = async () => {
  // Sample data simulating key findings from the survey.
  // In a real app, this might come from a CSV, database, or API.
  const surveyData: ChartData[] = [
    { name: 'Contaminant Effects', interest: 88 },
    { name: 'Indigenous Knowledges', interest: 92 },
    { name: 'New Assessment Tech', interest: 75 },
    { name: 'Data Visualization', interest: 81 },
    { name: 'Regulatory Policy', interest: 65 },
  ];

  const totalResponses = 66;

  return {
    props: {
      surveyData,
      totalResponses,
    },
  };
};

// 2. The page component receives the data as props.
const SurveyResultsPage: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  surveyData,
  totalResponses,
}) => {
  return (
    <>
      <Head>
        <title>Public Survey Results</title>
        <meta name="description" content="An overview of public survey results." />
      </Head>

      <main className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-md max-w-4xl mx-auto">

            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Public Survey Results 📊
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              An overview of key topics of interest based on {totalResponses} responses.
            </p>
            
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              Topic Interest Level (%)
            </h2>
            
            {/* Chart Container - ResponsiveContainer makes it adapt to screen size */}
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={surveyData}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="name" stroke="#555" />
                  <YAxis stroke="#555" />
                  <Tooltip
                    cursor={{ fill: 'rgba(239, 246, 255, 0.7)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #ddd',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="interest" fill="#3b82f6" name="Interest Level (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
          </div>
        </div>
      </main>
    </>
  );
};

export default SurveyResultsPage;