# **Strategic Plan: CEW & TWG Results Webpages**

This plan outlines the two-phase development for creating new results webpages for the SSTAC Dashboard, based on the findings in the "Modernizing BC Sediment Quality Standards v3.0" report.

**Project Goal:**

1. Create a "CEW-results" webpage based on **Appendix G**.  
2. Create a "TWG-results" webpage based on **Appendix J**.  
3. Ensure both new pages follow the layout and style of the existing "survey-results" webpage (based on **Appendix D**), including full light/dark mode compatibility.

## **Phase 1: Webpage Outlines**

This phase defines the content structure for each new page. The goal is to create a logical flow for the user, similar to the existing Appendix D webpage.

### **1\. Outline for cew-results page (Based on Appendix G)**

* **Page Header:** CEW Session: What We Heard  
* **1.0 Executive Summary:** (Content from G 1.0)  
* **2.0 Introduction & Context:**  
  * 2.1 Session Methodology (Content from G 2.0)  
  * 2.2 Building on the Public Survey (Content from G 3.0)  
* **3.0 Key Findings: Expert Poll Responses:** (Content from G 4.0)  
  * 3.1 Holistic Protection (Charts G-1 to G-8)  
  * 3.2 Tiered Framework (Charts G-9 to G-11)  
  * 3.3 Prioritization Framework (Charts G-12 to G-18)  
* **4.0 Key Findings: Prioritization Matrix:** (Content from G 5.0)  
  * (Charts G-19 to G-23, likely in a grid)  
* **5.0 Panel Discussion: Weaving Indigenous Knowledges:** (Content from G 6.0)  
* **6.0 Conclusion and Next Steps:** (Content from G 7.0)

### **2\. Outline for twg-results page (Based on Appendix J)**

*Note: Per the report, Sections 5.0 and 6.0 of Appendix J are marked "NOT TO BE INCLUDED IN PUBLISHED REPORT" and are excluded from this outline.*

* **Page Header:** TWG White Paper Review: What We Heard  
* **1.0 Executive Summary:** (Content from J 1.0)  
* **2.0 Methodology & Reviewer Profile:**  
  * 2.1 Methodology (Content from J 2.0)  
  * 2.2 Reviewer Area of Expertise (Chart J-1)  
  * 2.3 Overall Report Ratings (Chart J-2)  
* **3.0 Quantitative Findings: Strategic Priorities:** (Content from J 3.0)  
  * 3.1 Top Priority for Modernization (Chart J-3)  
  * 3.2 Top Priority for Future Research (Chart J-4)  
  * 3.3 Priority Contaminants (Chart J-5)  
  * 3.4 Priority Lines of Evidence (Chart J-6)  
  * 3.5 Preferred Bioavailability Methods (Chart J-7)  
  * 3.6 Selected "Tier 0" Approaches (Chart J-8)  
  * 3.7 Selected Framework Elements (Chart J-9)  
  * 3.8 Selected Desktop Study Components (Chart J-10)  
* **4.0 Detailed Qualitative Feedback & Synthesis:** (Content from J 4.0)  
  * 4.1 Overall Report Structure and Clarity  
  * 4.2 Integration of Indigenous Knowledge (IK)  
  * 4.3 Implementation, Feasibility, and Lab Capacity  
  * 4.4 Scientific Framework & Risk Assessment

## **Phase 2: Implementation Plan (Next.js & React)**

This step-by-step guide is for you and your Cursor IDE, targeting your Next.js 15+ App Router project.

### **Technology Context (Based on README.md & PROJECT\_STATUS.md)**

* **Framework:** Next.js 15+ (App Router)  
* **File Structure:** src/app/(dashboard)/...  
* **Styling:** Tailwind CSS (with dark: mode enabled)  
* **Strategy:** We will create new *route directories* containing page.tsx files. These will be server components, as they are for displaying static (but styled) report content.  
* **Template:** We will use src/app/(dashboard)/survey-results/holistic-protection/page.tsx as the template to clone.

### **1\. Development of cew-results page (Appendix G)**

Step 1: (USER) Prepare Your Assets  
This is a critical manual step.

1. Create a new folder: public/images/cew/.  
2. Export all charts from **Appendix G** (Figures G-1 through G-23) as high-resolution .png or .svg files.  
3. Save them into the public/images/cew/ folder (e.g., g-1.png, g-2.png, etc.).  
4. Copy all text content from **Appendix G** into a temporary text file.

**Step 2: (CURSOR) Create the New Page File**

1. **Prompt:**  
   @Cursor, read the file at \`src/app/(dashboard)/survey-results/holistic-protection/page.tsx\`.

   Create a new directory at \`src/app/(dashboard)/cew-results/\`.

   Inside this new directory, create a new file named \`page.tsx\` that is an exact copy of \`src/app/(dashboard)/survey-results/holistic-protection/page.tsx\`.

**Step 3: (CURSOR) Adapt the New Page Component**

1. **Prompt:**  
   @Cursor, in the new file \`src/app/(dashboard)/cew-results/page.tsx\`:

   1\.  Rename the default exported function (e.g., \`HolisticProtectionPage\`) to \`CewResultsPage\`.  
   2\.  Find the main \`\<h1\>\` and change its text to "CEW Session: What We Heard".  
   3\.  Delete all the existing JSX content \*inside\* the main layout container, leaving the main \`\<div\>\` or \`\<main\>\` wrapper intact.  
   4\.  Generate the new heading structure based on the \*\*Phase 1 CEW Outline\*\*. Use the project's existing Tailwind classes for dark/light mode text and backgrounds.

   For example:  
   \<div className="container mx-auto p-6 max-w-5xl"\>  
     \<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white"\>CEW Session: What We Heard\</h1\>

     {/\* 1.0 Executive Summary \*/}  
     \<section className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow"\>  
       \<h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100"\>1.0 Executive Summary\</h2\>  
       \<div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"\>  
         {/\* USER will paste content here \*/}  
       \</div\>  
     \</section\>

     {/\* 2.0 Introduction & Context \*/}  
     \<section className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow"\>  
       \<h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100"\>2.0 Introduction & Context\</h2\>  
       \<h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-200"\>2.1 Session Methodology\</h3\>  
       \<div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"\>  
         {/\* USER will paste content here \*/}  
       \</div\>  
       \<h3 className="text-xl font-semibold mt-4 mb-3 text-gray-700 dark:text-gray-200"\>2.2 Building on the Public Survey\</h3\>  
       \<div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"\>  
         {/\* USER will paste content here \*/}  
       \</div\>  
     \</section\>

     {/\* ... continue this pattern for all sections from the outline ... \*/}  
   \</div\>

**Step 4: (USER) Populate Text Content**

1. Go through cew-results/page.tsx and paste the text from **Appendix G** into the designated \<div\> containers.

**Step 5: (CURSOR) Insert Charts and Create Grids**

1. **Prompt (Single Chart):**  
   @Cursor, in \`src/app/(dashboard)/cew-results/page.tsx\`:

   1\.  Make sure \`import Image from 'next/image';\` is at the top of the file.  
   2\.  Find the \`\<h2\>\` for "3.0 Key Findings: Expert Poll Responses".  
   3\.  Directly under the \`\<h3\>\` for "3.1 Holistic Protection", insert the following JSX to display the first chart with proper dark/light mode styling:

   \<figure className="my-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md"\>  
     \<Image  
       src="/images/cew/g-1.png"  
       alt="Figure G-1: Importance of SedS-directECO"  
       width={800}  
       height={400}  
       className="w-full h-auto rounded-md border border-gray-200 dark:border-gray-600"  
     /\>  
     \<figcaption className="text-center text-sm italic text-gray-600 dark:text-gray-400 mt-3"\>  
       Figure G-1 \- Holistic Protection (Q1): Importance of SedS-directECO  
     \</figcaption\>  
   \</figure\>

2. **Prompt (Grid for multiple charts):**  
   @Cursor, in \`src/app/(dashboard)/cew-results/page.tsx\`, directly after the first chart you added, I need a grid for the next charts.

   Create a \`\<div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6"\>\`.

   Inside this grid, add two \`\<figure\>\` blocks (using the same styling from the previous prompt) for:  
   1\.  \`/images/cew/g-2.png\` (with its caption "Figure G-2...")  
   2\.  \`/images/cew/g-3.png\` (with its caption "Figure G-3...")

3. **User Action:** Continue this process for all charts. The 5 matrix charts (G-19 to G-23) might look best in a grid with md:grid-cols-2 lg:grid-cols-3.

**Step 6: (USER) Review**

1. Run npm run dev and navigate to http://localhost:3000/cew-results.  
2. Toggle dark/light mode to confirm all text and backgrounds are correct.  
3. Ensure all images load and the layout is consistent.

### **2\. Development of twg-results page (Appendix J)**

**Step 1: (USER) Prepare Your Assets**

1. Create a new folder: public/images/twg/.  
2. Export all charts from **Appendix J** (Figures J-1 through J-10) as images and save them to public/images/twg/.  
3. Copy text content from **Appendix J, Sections 1.0 through 4.0 only**.

**Step 2: (CURSOR) Create the New Page File**

1. **Prompt:**  
   @Cursor, create a new directory at \`src/app/(dashboard)/twg-results/\`.

   Inside this directory, create a new file named \`page.tsx\` that is an exact copy of the \`src/app/(dashboard)/cew-results/page.tsx\` file we just finished.

**Step 3: (CURSOR) Adapt the New Page Component**

1. **Prompt:**  
   @Cursor, in the new file \`src/app/(dashboard)/twg-results/page.tsx\`:

   1\.  Rename the component from \`CewResultsPage\` to \`TwgResultsPage\`.  
   2\.  Update the \`\<h1\>\` text to "TWG White Paper Review: What We Heard".  
   3\.  Delete all the existing JSX content (the Appendix G sections) from within the main layout wrapper.  
   4\.  Using the same theme-aware Tailwind classes, generate the new heading structure based on the \*\*Phase 1 TWG Outline\*\* (e.g., "1.0 Executive Summary", "2.0 Methodology & Reviewer Profile", "2.1 Methodology", etc.).

**Step 4: (USER) Populate Text Content**

1. Go through twg-results/page.tsx and paste the text from **Appendix J (Sections 1-4)** into the corresponding sections.

**Step 5: (CURSOR) Insert Charts**

1. **Prompt (Example):**  
   @Cursor, in \`src/app/(dashboard)/twg-results/page.tsx\`, under the "2.0 Methodology & Reviewer Profile" section:

   1\.  After the "2.1 Methodology" text, insert a dark-mode-aware \`\<figure\>\` block for \`/images/twg/j-1.png\` (with its caption).  
   2\.  After that, insert another \`\<figure\>\` block for \`/images/twg/j-2.png\` (with its caption).

   Under the "3.0 Quantitative Findings: Strategic Priorities" section:  
   1\.  Create a \`\<div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6"\>\`.  
   2\.  Add \`\<figure\>\` blocks inside the grid for \`j-3.png\` and \`j-4.png\`.

2. **User Action:** Continue this process for all 10 charts from Appendix J.

**Step 6: (USER) Finalize and Link**

1. Review http://localhost:3000/twg-results in your browser. Check dark/light modes.  
2. **Prompt (Final Step):**  
   @Cursor, open my main navigation component. Based on my project files, this is likely in \`src/app/(dashboard)/layout.tsx\` or \`src/components/shared/Sidebar.tsx\`.

   Find the navigation links array or list. I see links for "Survey Results" (which is a group).

   I want to add top-level links for the new pages. Find the "Survey Results" link/group and, at the same level, add two new navigation links:  
   1\.  A link to "CEW Session Results" pointing to \`/cew-results\`.  
   2\.  A link to "TWG Review Results" pointing to \`/twg-results\`.

   Ensure they use the same styling (including icons, if any) as the other main navigation items like "Dashboard" or "Survey Results".  
