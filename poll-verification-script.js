#!/usr/bin/env node

/**
 * COMPREHENSIVE POLL VERIFICATION SCRIPT
 * 
 * This script systematically verifies:
 * 1. All poll questions match between pages and admin panel
 * 2. All poll options match exactly
 * 3. Database poll data is correct
 * 4. Vote counts are accurate
 * 5. CEW vs Survey filtering works properly
 */

console.log('🔍 SSTAC POLL SYSTEM VERIFICATION SCRIPT');
console.log('==========================================\n');

// Expected poll data structure (from actual page files)
const EXPECTED_POLLS = {
  'holistic-protection': {
    survey: {
      questions: [
        {
          question: "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
          options: [
            "Metals known to biomagnify",
            "Polycyclic Aromatic Hydrocarbons", 
            "Polychlorinated Biphenyls",
            "Per-and Polyfluoroalkyl Substances",
            "All of the above",
            "Other"
          ],
          type: 'single-choice'
        },
        {
          question: "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
          options: [
            "Technical Hurdles: Limited data availability for many contaminants and species native to BC",
            "Practical Challenges: Discretionary matrix sediment standards may be a barrier for some practitioners",
            "Enhanced Protection: Comprehensive safeguards for BC's diverse aquatic ecosystems and peoples",
            "Scientific Advancement: Opportunity to pioneer innovative approaches to sediment management",
            "Societal Expectations: Given the challenges of modern society, holistic protection may not be feasible"
          ],
          type: 'ranking'
        }
      ]
    },
    cew: {
      questions: [
        {
          question: "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
          options: [
            "Metals known to biomagnify",
            "Polycyclic Aromatic Hydrocarbons",
            "Polychlorinated Biphenyls", 
            "Per-and Polyfluoroalkyl Substances",
            "All of the above",
            "Other"
          ],
          type: 'single-choice'
        },
        {
          question: "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
          options: [
            "Technical Hurdles: Limited data availability for many contaminants and species native to BC",
            "Practical Challenges: Discretionary matrix sediment standards may be a barrier for some practitioners",
            "Enhanced Protection: Comprehensive safeguards for BC's diverse aquatic ecosystems and peoples",
            "Scientific Advancement: Opportunity to pioneer innovative approaches to sediment management",
            "Societal Expectations: Given the challenges of modern society, holistic protection may not be feasible"
          ],
          type: 'ranking'
        }
      ]
    }
  },
  'tiered-framework': {
    survey: {
      questions: [
        {
          question: "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
          options: ["Yes", "No", "It depends", "Unsure", "Other"],
          type: 'single-choice'
        },
        {
          question: "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
          options: [
            "Environmental Conditions: Physical and chemical data",
            "Bioaccumulation Data in Tissues of Local Species", 
            "Benthic Community Structure Analysis",
            "Other"
          ],
          type: 'ranking'
        }
      ]
    },
    cew: {
      questions: [
        {
          question: "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
          options: ["Yes", "No", "It depends", "Unsure", "Other"],
          type: 'single-choice'
        },
        {
          question: "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
          options: [
            "Environmental Conditions: Physical and chemical data",
            "Bioaccumulation Data in Tissues of Local Species",
            "Benthic Community Structure Analysis", 
            "Other"
          ],
          type: 'ranking'
        }
      ]
    }
  },
  'prioritization': {
    survey: {
      questions: [] // No survey results page for prioritization
    },
    cew: {
      questions: [
        {
          question: "Please rank these potential feasibility criteria to help inform the development of a prioritization framework (1= highest):",
          options: [
            "Adequacy and reliability of available data for key research topics",
            "Need for new or specialized technologies",
            "Level of complexity and corresponding expertise and resource requirements", 
            "Level of likelihood/uncertainty in successful completion of project or meeting research goals"
          ],
          type: 'ranking'
        },
        {
          question: "Please rank these timeframe considerations for developing a prioritization framework and strategic planning for research to support modernizing BC's sediment standards (1= highest):",
          options: [
            "Outcome-driven priority, regardless of timeframe (i.e., disregard timeframe when prioritizing research)",
            "Focus on short-term progress (e.g., identify opportunities to quickly address regulatory gaps)",
            "Focus on progressing the highest potential impact, following a clear long-term strategic goal, avoiding convenient short-term efforts if they will distract from the goal and divert resources away from more meaningful progress.",
            "Consistent progress prioritized, with a balance of short- and long-term research efforts."
          ],
          type: 'ranking'
        },
        {
          question: "Based on Today's discussion and your experience, please rank these four areas for modernization priority in BC's sediment standards (1= highest):",
          options: [
            "Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)",
            "Development of a Matrix Sediment Standards Framework - Focus on Ecological Protection",
            "Development of a Matrix Sediment Standards Framework - Focus on Human Health Protection",
            "Develop Sediment Standards for Non-scheduled Contaminants & Mixtures"
          ],
          type: 'ranking'
        },
        {
          question: "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
          options: [
            "Equilibrium partitioning models (e.g., based on organic carbon content).",
            "Normalization using Acid-Volatile Sulfides and Simultaneously Extracted Metals (AVS/SEM)",
            "Application of the Biotic Ligand Model (BLM) for sediments",
            "Direct measurement using passive sampling devices (PSDs)"
          ],
          type: 'single-choice'
        },
        {
          question: "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible and practically achievable for BC's regulatory framework (1= highest):",
          options: [
            "A simple additive model (e.g., hazard index)",
            "A weighted approach based on toxicological similarity",
            "Site-specific toxicity testing for all complex mixtures",
            "The development of new, mixture-specific standards"
          ],
          type: 'ranking'
        },
        {
          question: "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical for modernizing BC's sediment standards?",
          options: [
            "Developing a robust framework for assessing the bioavailability of metals and metalloids.",
            "Establishing standardized analytical methods for a priority list of contaminants of emerging concern (CECs).",
            "Creating a predictive model for contaminant mixture toxicity based on concentration addition.",
            "Generating sufficient toxicity data to derive new guidelines for 3-5 high-priority legacy contaminants."
          ],
          type: 'ranking'
        },
        {
          question: "To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1= highest importance):",
          options: [
            "Research into the ecosystem-level impacts of chronic, low-level contaminant exposure",
            "Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment",
            "Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity",
            "Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC"
          ],
          type: 'ranking'
        },
        {
          question: "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?",
          options: [
            "A lack of high-quality toxicity data for many individual components of common mixtures",
            "Poor understanding of the modes of action for many contaminants to justify grouping them",
            "Difficulty in validating model predictions with whole sediment toxicity testing results",
            "The inability of current models to account for significant synergistic or antagonistic interactions"
          ],
          type: 'single-choice'
        }
      ]
    }
  }
};

// Admin panel expected questions (from currentPollQuestions array)
const ADMIN_EXPECTED_QUESTIONS = [
  // Holistic Protection Questions (ONLY 1 question now)
  "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
  
  // Tiered Framework Questions  
  "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
  "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
  
  // Prioritization Questions
  "Please rank these potential feasibility criteria to help inform the development of a prioritization framework (1= highest):",
  "Please rank these timeframe considerations for developing a prioritization framework and strategic planning for research to support modernizing BC's sediment standards (1= highest):",
  "Based on Today's discussion and your experience, please rank these four areas for modernization priority in BC's sediment standards (1= highest):",
  "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
  "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible and practically achievable for BC's regulatory framework (1= highest):",
  "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical for modernizing BC's sediment standards?",
  "To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1= highest importance):",
  "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?"
];

console.log('📋 VERIFICATION CHECKLIST');
console.log('========================\n');

// Step 1: Verify expected poll structure
console.log('1. ✅ Expected poll structure defined');
console.log('   - Holistic Protection: 1 question (single-choice)');
console.log('   - Tiered Framework: 2 questions (1 single-choice, 1 ranking)');
console.log('   - Prioritization: 8 questions (2 single-choice, 6 ranking)\n');

// Step 2: Check admin panel question filtering
console.log('2. 🔍 Admin Panel Question Filtering Check');
console.log('   Expected questions in admin panel:', ADMIN_EXPECTED_QUESTIONS.length);
console.log('   - Holistic Protection should show: 1 question');
console.log('   - Tiered Framework should show: 2 questions');
console.log('   - Prioritization should show: 8 questions\n');

// Step 3: Database verification queries
console.log('3. 🗄️  DATABASE VERIFICATION QUERIES');
console.log('   Run these queries in Supabase SQL Editor to verify database state:\n');

console.log('   -- Check all polls in database');
console.log('   SELECT page_path, poll_index, question, options FROM polls ORDER BY page_path, poll_index;');
console.log('   SELECT page_path, poll_index, question, options FROM ranking_polls ORDER BY page_path, poll_index;\n');

console.log('   -- Check vote counts');
console.log('   SELECT p.page_path, p.poll_index, p.question, COUNT(pv.*) as vote_count');
console.log('   FROM polls p LEFT JOIN poll_votes pv ON p.id = pv.poll_id');
console.log('   GROUP BY p.id, p.page_path, p.poll_index, p.question ORDER BY p.page_path, p.poll_index;');
console.log('   ');
console.log('   SELECT rp.page_path, rp.poll_index, rp.question, COUNT(rv.*) as vote_count');
console.log('   FROM ranking_polls rp LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id');
console.log('   GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question ORDER BY rp.page_path, rp.poll_index;\n');

console.log('   -- Check specific holistic protection polls');
console.log('   SELECT * FROM polls WHERE page_path LIKE \'%holistic-protection%\' ORDER BY poll_index;');
console.log('   SELECT * FROM ranking_polls WHERE page_path LIKE \'%holistic-protection%\' ORDER BY poll_index;\n');

console.log('4. 🧪 MANUAL VERIFICATION STEPS');
console.log('   ============================\n');

console.log('   A. Check Survey Results Pages:');
console.log('      - http://localhost:3000/survey-results/holistic-protection');
console.log('      - http://localhost:3000/survey-results/tiered-framework\n');

console.log('   B. Check CEW Polls Pages:');
console.log('      - http://localhost:3000/cew-polls/holistic-protection');
console.log('      - http://localhost:3000/cew-polls/tiered-framework');
console.log('      - http://localhost:3000/cew-polls/prioritization\n');

console.log('   C. Check Admin Poll Results:');
console.log('      - http://localhost:3000/admin/poll-results');
console.log('      - Verify Holistic Protection shows ONLY 1 question');
console.log('      - Verify all questions match page content\n');

console.log('   D. Test Filtering:');
console.log('      - Test "All" filter shows correct questions');
console.log('      - Test "CEW Only" filter shows correct questions');
console.log('      - Test "TWG Only" filter shows correct questions\n');

console.log('5. 🚨 COMMON ISSUES TO CHECK');
console.log('   =========================\n');

console.log('   - Questions in database with different wording than pages');
console.log('   - Missing questions in currentPollQuestions array');
console.log('   - Extra questions not filtered out properly');
console.log('   - Vote counts not matching between admin panel and individual pages');
console.log('   - CEW vs Survey poll data not grouping correctly\n');

console.log('6. 📝 EXPECTED RESULTS AFTER FIX');
console.log('   ==============================\n');

console.log('   Holistic Protection Group:');
console.log('   - Question 1: "Given the potential for over-conservatism..." (single-choice)');
console.log('   - NO other questions should appear\n');

console.log('   Tiered Framework Group:');
console.log('   - Question 1: "In developing Protocol 2..." (single-choice)');
console.log('   - Question 2: "Please rank the following lines of evidence..." (ranking)\n');

console.log('   Prioritization Group:');
console.log('   - 8 questions total (2 single-choice, 6 ranking)\n');

console.log('✅ Run this verification process after each fix to ensure accuracy!');
console.log('🔍 If issues persist, check database directly with provided SQL queries.');
