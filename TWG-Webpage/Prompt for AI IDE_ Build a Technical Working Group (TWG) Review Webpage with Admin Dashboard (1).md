### **Prompt for AI IDE: Build a Technical Working Group (TWG) Review Webpage with Admin Dashboard**

**Objective:** Extend the existing SSTAC & TWG Dashboard platform to create a secure, user-friendly, and efficient webpage to collect detailed technical feedback on the "Modernizing British Columbia's Sediment Standards" report from a group of approximately 50 expert reviewers, and an associated admin-only dashboard to autonomously synthesize and summarize the responses.

**IMPORTANT:** This development must build upon the existing production-ready SSTAC & TWG Dashboard system, utilizing the established authentication, database schema, and component architecture patterns.

---

#### **\*\*\*\***

**Purpose:** To establish the foundational functionality and structure of the entire review webpage.

**Features/Functionality (BUILDING ON EXISTING SYSTEM):**

1. **Authentication:** Leverage the existing dual-mode authentication system:
   - **Authenticated Users:** Use existing Supabase Auth with automatic role assignment
   - **TWG Members:** Extend existing user management system for TWG-specific access
   - **Admin Access:** Utilize existing admin role management and badge persistence system

2. **Save Progress Functionality:** Implement using existing patterns:
   - Use existing database schema with new `review_submissions` table
   - Leverage existing API route patterns for data persistence
   - Implement "Save Progress" button using existing component patterns
   - Store form state in database with user association

3. **Responsive Design:** Build upon existing theme system:
   - Use existing Tailwind CSS v4 configuration
   - Leverage existing dark/light mode theme system
   - Follow existing mobile-first responsive patterns
   - Utilize existing component styling conventions

4. **Clear Navigation:** Implement using existing navigation patterns:
   - Use existing sidebar navigation component structure
   - Leverage existing form section management patterns
   - Implement progress tracking using existing state management
   - Follow existing UI/UX patterns for consistency

5. **Data Submission:** Integrate with existing database and API architecture:
   - Extend existing database schema with review-specific tables
   - Use existing API route patterns for data submission
   - Leverage existing RLS policies for data security
   - Integrate with existing admin dashboard for data visualization

---

#### **\*\*\*\***

**Purpose:** To welcome the reviewer, establish the context for the review, and provide clear instructions.

**Features/Functionality:**

* A static header section containing the project title.  
* An introductory text block.

**Content/Prompts:**

* **Page Title:** TWG Review: Modernizing BC’s Sediment Standards  
* **Header:** Expert Review Form: Modernizing British Columbia’s Sediment Standards  
* **Introduction Text:**  
  "Welcome and thank you for contributing your expertise to this critical initiative. This form is designed to collect detailed feedback on the 'Modernizing British Columbia’s Sediment Standards' report. Your input will directly inform the options analysis and recommendations for the next phase of this project.  
  **Instructions:**  
  * Please complete all sections to the best of your ability.  
  * You may use the 'Save Progress' button at any time to save your work and return later.  
  * The form is divided into sections that mirror the report's structure. Please use the navigation pane on the left to move between sections.  
  * The estimated time to complete this review is 60-90 minutes.  
  * **Submission Deadline:**"

---

#### **\*\*\*\***

**Purpose:** To collect optional but valuable information about the reviewer's background to help contextualize their feedback.

**Features/Functionality:**

* Standard text input fields.  
* A multi-select checkbox group.

**Content/Prompts:**

* **Section Header:** Part 1: Reviewer Information (Optional)  
* **Field 1 (Text Input):** Name and Affiliation:  
* **Field 2 (Checkboxes, Multi-select):** Primary Area(s) of Expertise (please select all that apply):  
  * \[ \] Ecotoxicology  
  * \[ \] Human Health Risk Assessment (HHRA)  
  * \[ \] Environmental Chemistry  
  * \[ \] Regulatory Policy & Law  
  * \[ \] Indigenous Knowledge Systems  
  * \[ \] Bioavailability & Contaminant Fate  
  * \[ \] Benthic Ecology  
  * \[ \] Food Web Modeling & Bioaccumulation  
  * \[ \] Site Remediation & Engineering  
  * \[ \] Other (please specify)  
  * **(Conditional Text Input appears if "Other" is selected)**

---

#### **\*\*\*\***

**Purpose:** To capture the reviewer's overall impressions of the report's quality, clarity, and scientific rigor.

**Features/Functionality:**

* A set of rating scales (radio buttons).  
* An open-ended text area for qualitative feedback.

**Content/Prompts:**

* **Section Header:** Part 2: High-Level Report Assessment  
* **Question 1 (Rating Scale):** Please rate the report on the following attributes:  
  * Overall Clarity and Readability:  
    * ( ) Excellent ( ) Good ( ) Fair ( ) Poor  
  * Completeness of the Scientific Review and Jurisdictional Scan:  
    * ( ) Excellent ( ) Good ( ) Fair ( ) Poor  
  * Scientific Defensibility of the Proposed Framework:  
    * ( ) Excellent ( ) Good ( ) Fair ( ) Poor  
* **Question 2 (Text Area):** Please provide specific comments to explain your ratings above or to offer general, high-level feedback on the report.

---

#### **\*\*\*\***

**Purpose:** To gather specific, technical feedback on the proposed Matrix Sediment Standards Framework.

**Features/Functionality:**

* A contextual information block with a hyperlink.  
* A ranking poll question.  
* An open-ended text area.

**Content/Prompts:**

* **Section Header:** Part 3: The Matrix Sediment Standards Framework  
* **Context Block:**"This section focuses on the **Matrix Sediment Standards Framework** (see Section V.B of the report), which proposes separate standards for direct exposure (SedS-direct) and food pathway exposure (SedS-food) to protect both ecological and human health.1 The initial public survey showed 83% of respondents found this 'Dual Standard' approach necessary.3"  
* **Question 1 (Ranking Poll):** The development of food pathway standards (SedS-food) will require significant scientific effort. Please rank the following contaminant groups for which this work is the highest priority (1 \= Highest Priority). 2  
  * Mercury and its compounds  
  * Polychlorinated Biphenyls (PCBs)  
  * Per- and Polyfluoroalkyl Substances (PFAS)  
  * Dioxins and Furans  
  * Legacy Organochlorine Pesticides  
* **Question 2 (Text Area):** What are the primary scientific or practical challenges you foresee in implementing the Matrix Framework? Please provide specific suggestions for addressing these challenges.

---

#### **\*\*\*\***

**Purpose:** To gather expert feedback on the structure and scientific basis of the proposed Tiered Assessment Approach.

**Features/Functionality:**

* A contextual information block.  
* A multiple-choice poll question.  
* A ranking poll question.  
* An open-ended text area.

**Content/Prompts:**

* **Section Header:** Part 4: The Tiered Assessment Approach  
* **Context Block:**"This section focuses on the **Tiered Assessment Approach** (see Section V.B of the report), which moves from initial screening (Tier 1\) to more detailed site-specific assessments. A key proposal is the distinction between **Tier 2a** (bioavailability adjustments only) and **Tier 2b** (incorporating additional lines of evidence within a screening-level risk assessment).1"  
* **Question 1 (Multiple Choice):** Incorporating bioavailability was identified as a top priority from survey responses.3 Which scientific approach to bioavailability holds the most promise for practical and defensible application in a Tier 2a framework? 4  
  * ( ) Equilibrium partitioning models (e.g., based on organic carbon content)  
  * ( ) Normalization using Acid-Volatile Sulfides/Simultaneously Extracted Metals (AVS/SEM)  
  * ( ) Direct measurement using passive sampling devices (PSDs)  
  * ( ) Other (please specify)  
  * **(Conditional Text Input appears if "Other" is selected)**  
* **Question 2 (Ranking Poll):** For a Tier 2b screening-level risk assessment, please rank the following lines of evidence in order of importance for developing a robust framework (1 \= Most Important). 5  
  * Site-specific bioavailability data (e.g., grain size, TOC, AVS/SEM)  
  * Bioaccumulation data in tissues of local species  
  * Benthic community structure analysis  
  * In-situ or lab-based toxicity testing  
* **Question 3 (Text Area):** What specific technical guidance, protocols, or models are most essential to ensure the Tiered Assessment Approach is implemented consistently and defensibly across the province?

---

#### **\*\*\*\***

**Purpose:** To solicit constructive feedback on the proposed mechanisms for braiding Indigenous Knowledge with Western science.

**Features/Functionality:**

* A contextual information block.  
* A multiple-choice poll question.  
* An open-ended text area.

**Content/Prompts:**

* **Section Header:** Part 5: Integration of Indigenous Knowledge  
* **Context Block:**"The report identifies 'Protection of Indigenous Rights and Uses' and 'Integration of Indigenous Knowledge' as core guiding principles (see Section V.A of the report).1 This section seeks feedback on the technical and scientific opportunities for braiding knowledge systems."  
* **Question 1 (Multiple Choice):** Within a tiered framework, where can place-based Indigenous Knowledge provide the most direct scientific value for modifying a generic baseline value to be more site-specific? (Select up to two). 6  
  * \[ \] Informing bioavailability models with specific knowledge of local sediment characteristics and processes.  
  * \[ \] Identifying sensitive local species or life stages not included in the generic models for a more accurate risk calculation.  
  * \[ \] Characterizing unique, site-specific contaminant exposure pathways that would alter baseline risk model assumptions.  
  * \[ \] Identifying potential confounding environmental factors (e.g., freshwater seeps) influencing scientific measurements.  
* **Question 2 (Text Area):** From a technical and scientific perspective, what are the key opportunities or challenges in braiding Indigenous Knowledge with the proposed scientific frameworks (Matrix and Tiered Approach)?

---

#### **\*\*\*\***

**Purpose:** To gather expert consensus on priorities for research, development, and implementation to guide the project's next steps.

**Features/Functionality:**

* A series of ranking poll questions.

**Content/Prompts:**

* **Section Header:** Part 6: Prioritization and Strategic Direction  
* **Question 1 (Ranking Poll):** Based on your experience, please rank these four areas for modernization priority in BC's sediment standards (1 \= highest): 4  
  * Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)  
  * Development of a Matrix Sediment Standards Framework \- Focus on Ecological Protection  
  * Development of a Matrix Sediment Standards Framework \- Focus on Human Health Protection  
  * Develop Sediment Standards for Non-scheduled Contaminants & Mixtures  
* **Question 2 (Ranking Poll):** To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1 \= highest importance): 4  
  * Research into the ecosystem-level impacts of chronic, low-level contaminant exposure  
  * Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment  
  * Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity  
  * Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC

---

#### **\*\*\*\***

**Purpose:** To provide a dedicated space for detailed, line-by-line feedback and the submission of annotated documents.

**Features/Functionality:**

* A large, resizable text area.  
* A file upload component that accepts common document formats (e.g.,.docx,.pdf).

**Content/Prompts:**

* **Section Header:** Part 7: Line-by-Line Comments and Document Upload  
* **Instructions for Text Area:** Please use the space below to provide any specific, line-by-line comments. Please reference the relevant Page Number, Section, and Line Number to ensure clarity.  
* **Text Area:** (A large, empty text area should be provided here).  
* **Instructions for File Upload:** Alternatively, if you have commented directly on the report document, you may upload your annotated file here. (Accepted formats: DOCX, PDF. Max file size: 10MB).  
* **File Upload Button:** \[Upload File\]

---

#### **\*\*\*\***

**Purpose:** To capture any final thoughts and provide the final submission action.

**Features/Functionality:**

* Two open-ended text areas.  
* A final "Submit" button.  
* A confirmation message upon successful submission.

**Content/Prompts:**

* **Section Header:** Part 8: Final Recommendations  
* **Question 1 (Text Area):** Are there any critical scientific gaps, alternative approaches, or significant risks that you believe the report has overlooked?  
* **Question 2 (Text Area):** Please provide any other comments or suggestions you have for improving the report or the proposed framework.  
* **Submission Button:** \`\`  
* **Confirmation Message (to be displayed after submission):**"Thank you. Your feedback has been successfully submitted. Your expertise is invaluable to the modernization of British Columbia's sediment standards. You may now close this window."

---

#### **\*\*\*\***

**Purpose:** To extend the existing admin dashboard to autonomously analyze, synthesize, and visualize the feedback collected from the TWG review form. This dashboard will serve as the primary tool for generating the "What We Heard" report.

**Features/Functionality (EXTENDING EXISTING ADMIN SYSTEM):**

1. **Secure Access:** Leverage existing admin authentication and role management:
   - Use existing admin role verification system
   - Utilize existing admin badge persistence system
   - Follow existing admin page patterns and structure
   - Integrate with existing admin navigation

2. **Global Filters:** Extend existing admin filtering capabilities:
   - Build upon existing user management filters
   - Integrate with existing tag and category filtering system
   - Use existing search and filter component patterns
   - Leverage existing data segmentation capabilities

3. **Data Export:** Extend existing admin data export functionality:
   - Build upon existing CSV export patterns
   - Integrate with existing PDF generation capabilities
   - Use existing data visualization export features
   - Follow existing admin data management patterns

**Dashboard Components (EXTENDING EXISTING COMPONENTS):**

* **Component 1: Quantitative Analysis Dashboard**  
  * **Function:** Extend existing poll results visualization system for review form data
  * **Implementation:** 
    * Use existing `PollResultsChart` component patterns
    * Leverage existing `InteractiveBarChart` and `InteractivePieChart` components
    * Integrate with existing real-time data update system
    * Follow existing chart styling and responsive design patterns
  * **Visualizations:**  
    * **Rating Scales & Multiple Choice:** Extend existing bar chart components
    * **Ranking Polls:** Use existing ranking poll visualization patterns
  * **Metrics:** Integrate with existing admin statistics display system

* **Component 2: Qualitative Synthesis (AI-Powered)**  
  * **Function:** Extend existing discussion forum analysis capabilities
  * **Implementation:**
    * Build upon existing discussion content analysis
    * Integrate with existing text processing capabilities
    * Use existing admin content management patterns
    * Follow existing data visualization component structure
  * **Sub-features:**  
    * **Thematic Analysis:** Extend existing discussion topic analysis
    * **Sentiment Analysis:** Build upon existing user engagement metrics
    * **Key Phrase Extraction:** Use existing content analysis patterns
    * **Quote Selection:** Integrate with existing content management system

* **Component 3: Consolidated Comments Viewer**  
  * **Function:** Extend existing document management and discussion system
  * **Implementation:**
    * Build upon existing `DocumentsList` component
    * Integrate with existing discussion forum interface
    * Use existing search and filter functionality
    * Follow existing content organization patterns
  * **Sub-features:**  
    * **Unified View:** Extend existing content aggregation system
    * **Search and Filter:** Use existing search and filter components
    * **File Management:** Integrate with existing document upload/download system

* **Component 4: Raw Data Table**  
  * **Function:** Extend existing admin user management table
  * **Implementation:**
    * Use existing `AdminUsersManager` component patterns
    * Leverage existing table sorting and pagination
    * Integrate with existing data export functionality
    * Follow existing admin table styling and interaction patterns
  * **Features:**  
    * Use existing table component structure
    * Integrate with existing data management patterns
    * Follow existing admin interface conventions

---

I've added a new module to the plan that details the requirements for an admin-only dashboard. This dashboard is designed to autonomously synthesize and summarize the quantitative and qualitative data from the review form, which should greatly assist in analyzing the feedback and preparing your report.