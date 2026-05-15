# Matrix Dashboard Plan

## Executive Summary
The primary objective of the Phase 2 UI pivot is to transition from a single-purpose calculator to a comprehensive, interactive collaborative policy dashboard. The goal of this environment is to provide a dedicated, interactive workspace for Technical Working Group (TWG) members to review, discuss, and analyze the Matrix Options Paper. By consolidating relevant data, geospatial context, and qualitative research into a single accessible portal, we can streamline the review process, foster more informed discussions, and capture structured feedback efficiently. This pivot requires a fundamental architectural shift to support multi-faceted data presentation and interactive polling mechanisms.

## UI/UX Structure
To support the diverse needs of the TWG review process, the dashboard will be organized into five primary tabs, complemented by a persistent contextual utility panel.

### Main Navigation Tabs
1. **The Guide**: The landing page for the dashboard. It will serve as an onboarding portal, providing an overview of the Matrix Options Paper, instructions on how to use the dashboard tools, and a high-level summary of the regulatory decisions at hand.
2. **Conceptual Model**: An interactive, visual representation of the scientific and regulatory pathways underpinning the matrix options. This tab will allow users to explore the relationships between sediment quality standards, ecological impacts, and human health risk factors through interactive diagrams.
3. **Case Studies**: A deep-dive section showcasing practical applications of the proposed matrix options. This tab will present historical and hypothetical scenarios, demonstrating how different policy choices impact real-world outcomes. 
4. **Interactive Map**: A geospatial visualization tool plotting relevant sediment sample sites, historical data points, and jurisdictional boundaries. It will feature filtering capabilities to overlay different environmental indicators and regulatory thresholds.
5. **TWG Review**: The dedicated workspace for formal evaluation. This section will aggregate the options under consideration, providing side-by-side comparisons and structured mechanisms for submitting feedback, votes, or detailed commentary on specific regulatory proposals.

### Collapsible Right Panel
- **Context/Polls**: A persistent, collapsible sidebar available across all main tabs. It will serve dual purposes:
  - **Contextual Help**: Displaying dynamic definitions, reference material, or supplementary data relevant to the currently active tab or selected element.
  - **Live Polling**: Facilitating real-time feedback gathering during TWG meetings or asynchronous review periods, allowing members to quickly register their stance on specific issues as they navigate the dashboard.

## Content Roadmap

- **Jurisdictional Math Synthesis (EqP & AVS/SEM)**: Translate the extracted raw LaTeX formulas from SedS_contactECO_EqP_Math.md (covering US EPA, CCME, ANZG, RIVM) into digestible, comparative case studies for the Ecological Direct Contact quadrant.
- **Bioaccumulation Frameworks (BSAF)**: Synthesize the food-web transfer equations from SedS_foodECO_BSAF_Math.md to demonstrate how different agencies back-calculate sediment thresholds from tissue residue guidelines.
- **Human Health & Indigenous Pathways**: Synthesize SedS_HumanHealth_Derivation_Math.md to outline the methodologies for integrating localized traditional food consumption rates and wetted-sediment dermal contact models into the Matrix framework.
