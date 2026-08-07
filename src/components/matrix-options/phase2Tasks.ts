// Phase 2 (2026) Tasks & Activities Data.
// Plain ASCII only.

export interface Phase2Subtask {
  id: string;
  subtask: string;
  deadline: string;
  estHours: number;
  lead: string;
}

export interface Phase2Task {
  id: string;
  title: string;
  subtasks: Phase2Subtask[];
}

export const phase2Tasks: Phase2Task[] = [
  {
    id: "Task 1",
    title: "Project Mobilization and Governance Setup",
    subtasks: [
      { id: "1.1", subtask: "ENV & SABCS meeting to discuss this project plan", deadline: "Week 1", estHours: 10, lead: "Internal + SABCS" },
      { id: "1.2", subtask: "Confirm approach for utilizing SSTAC (data sharing, engagement, and funding support)", deadline: "Week 1", estHours: 10, lead: "Internal + SABCS" },
      { id: "1.3", subtask: "Confirm approach for engaging full TWG on key review checkpoints of the Options Paper", deadline: "Week 1", estHours: 10, lead: "Internal + SABCS" },
      { id: "1.4", subtask: "Project kickoff email to SSTAC and TWG (priority, deliverable, timeline, collaborative approach, call for focused TWG expansion)", deadline: "Week 1", estHours: 4, lead: "Internal + SABCS" },
      { id: "1.5", subtask: "ENV & SSTAC meeting to discuss this project plan", deadline: "Week 2", estHours: 15, lead: "Internal + SABCS + SSTAC" },
      { id: "1.6", subtask: "Confirm SSTAC membership and resourcing", deadline: "Week 2", estHours: 12, lead: "Internal + SABCS" },
      { id: "1.7", subtask: "Develop SSTAC scope, deliverables, timelines", deadline: "Week 2", estHours: 15, lead: "Internal + SABCS" },
      { id: "1.8", subtask: "Develop detailed TWG workplans (per task: objective, deliverable, timeline, focused TWG role, engagement)", deadline: "Week 2", estHours: 33, lead: "Internal + SABCS + Focused TWG" },
    ]
  },
  {
    id: "Task 2",
    title: "Develop Early DRAFT Options Paper",
    subtasks: [
      { id: "2.1", subtask: "Develop conceptual draft Options Paper (structure and skeleton)", deadline: "Week 2", estHours: 20, lead: "Internal" },
      { id: "2.2", subtask: "Circulate conceptual draft (focus Sections 4 & 7)", deadline: "Week 3", estHours: 15, lead: "Internal + Focused TWG" },
      { id: "2.3", subtask: "Collaborative development of the rough draft (to engage full TWG)", deadline: "Week 4", estHours: 50, lead: "Internal + Focused TWG" },
      { id: "2.4", subtask: "Compile and synthesize comments", deadline: "Week 5", estHours: 40, lead: "Internal + Focused TWG" },
      { id: "2.5", subtask: "Revise Options Paper (technical + policy alignment)", deadline: "Month 2", estHours: 80, lead: "Internal + Focused TWG" },
    ]
  },
  {
    id: "Task 3",
    title: "Database Development and Input Parameter Compilation",
    subtasks: [
      { id: "3.1", subtask: "Identify reports with sediment concentration data", deadline: "Month 1", estHours: 80, lead: "Internal + TWG" },
      { id: "3.2", subtask: "Review existing framework; determine info needs (parameters, endpoints, media)", deadline: "Month 3", estHours: 60, lead: "Internal + TWG" },
      { id: "3.3", subtask: "Review and confirm database structure (BC Aquatic Database)", deadline: "Month 3", estHours: 70, lead: "Internal + TWG" },
      { id: "3.4", subtask: "Data compilation (literature, reports, datasets)", deadline: "Month 4 - ongoing", estHours: 180, lead: "Internal + TWG" },
      { id: "3.5", subtask: "QA/QC and data usability screening", deadline: "Month 7", estHours: 70, lead: "Internal + TWG" },
      { id: "3.6", subtask: "Develop BC Aquatic Database and source inventory", deadline: "Month 7", estHours: 220, lead: "Internal + TWG" },
      { id: "3.7", subtask: "Define input parameter scope and templates (TRVs for human and ecological health, grain size thresholds, receptor characteristics, exposure assumptions, water lot use classes; reference Protocol 28)", deadline: "Month 1-2", estHours: 50, lead: "Internal + TWG" },
      { id: "3.8", subtask: "Compile input parameter values, information and references", deadline: "Month 3 - ongoing", estHours: 340, lead: "Internal + TWG" },
      { id: "3.9", subtask: "Review and QA input parameter compilation", deadline: "Month 8", estHours: 70, lead: "Internal + TWG" },
    ]
  },
  {
    id: "Task 4",
    title: "Bioavailability Framework Development",
    subtasks: [
      { id: "4.1", subtask: "Review applicable approaches for bioavailability adjustment", deadline: "Month 4-5", estHours: 90, lead: "Internal + TWG" },
      { id: "4.2", subtask: "Assess applicability to BC sediment types", deadline: "Month 5", estHours: 50, lead: "Internal + TWG" },
      { id: "4.3", subtask: "Identify data requirements and constraints", deadline: "Month 5", estHours: 30, lead: "Internal + TWG" },
      { id: "4.4", subtask: "Draft BC bioavailability framework approach", deadline: "Month 6", estHours: 65, lead: "Internal + TWG" },
      { id: "4.5", subtask: "Internal technical review", deadline: "Month 6-7", estHours: 35, lead: "Internal + TWG" },
    ]
  },
  {
    id: "Task 5",
    title: "Bioaccumulation and Substance Classification",
    subtasks: [
      { id: "5.1", subtask: "Review approaches and jurisdictional practices for bioaccumulation", deadline: "Month 5-6", estHours: 100, lead: "Internal + TWG" },
      { id: "5.2", subtask: "Develop classification criteria (biomagnification, persistence, toxicity)", deadline: "Month 6-7", estHours: 120, lead: "Internal + TWG" },
      { id: "5.3", subtask: "Develop preliminary substance prioritization framework", deadline: "Month 7-8", estHours: 120, lead: "Internal + TWG" },
      { id: "5.4", subtask: "Validate against BC occurrence data", deadline: "Month 8", estHours: 80, lead: "Internal + TWG" },
      { id: "5.5", subtask: "Produce classification and prioritization framework document", deadline: "Month 8", estHours: 40, lead: "Internal + TWG" },
    ]
  },
  {
    id: "Task 6",
    title: "Matrix Framework Design (Multi-Pathway Integration)",
    subtasks: [
      { id: "6.1", subtask: "Identify and evaluate options for equations to derive Matrix Numerical Sediment Standards for each of the four receptor-pathways", deadline: "Month 1-3", estHours: 70, lead: "Internal + TWG" },
      { id: "6.2", subtask: "Define structure for the four pathways", deadline: "Month 6-7", estHours: 60, lead: "Internal + TWG" },
      { id: "6.3", subtask: "Define triggers and decision logic (applicability) for each pathway", deadline: "Month 7", estHours: 60, lead: "Internal + TWG" },
      { id: "6.4", subtask: "Integrate Indigenous consumption modifiers and high-use scenarios", deadline: "Month 7", estHours: 50, lead: "Internal + TWG" },
      { id: "6.5", subtask: "Draft integrated matrix framework architecture (equations, structure, triggers)", deadline: "Month 8", estHours: 100, lead: "Internal + TWG" },
      { id: "6.6", subtask: "Internal review and refinement", deadline: "Month 8-9", estHours: 40, lead: "Internal" },
    ]
  },
  {
    id: "Task 7",
    title: "Generic Standards Adoption Procedure and Schedule 3.4 Expansion Concept (Policy Integration)",
    subtasks: [
      { id: "7.1", subtask: "Define scope of Schedule 3.4 expansion (three part structure: matrix + generic human health + generic ecological health; pathways and substances)", deadline: "Month 6", estHours: 15, lead: "Internal" },
      { id: "7.2", subtask: "Develop procedure for adopting Generic Numerical Sediment Standards from other jurisdictions (US, Australia, New Zealand) - Parts 2 and 3", deadline: "Month 7-8", estHours: 60, lead: "Internal + TWG" },
      { id: "7.3", subtask: "Align matrix framework outputs with CSR structure", deadline: "Month 6", estHours: 20, lead: "Internal" },
      { id: "7.4", subtask: "Develop concept for multi-pathway standards structure", deadline: "Month 6", estHours: 20, lead: "Internal" },
      { id: "7.5", subtask: "Draft policy-ready outline for future regulatory integration", deadline: "Month 7", estHours: 20, lead: "Internal" },
      { id: "7.6", subtask: "Internal policy/legal review", deadline: "Month 8", estHours: 15, lead: "Internal" },
    ]
  },
  {
    id: "Task 8",
    title: "Integration and Synthesis",
    subtasks: [
      { id: "8.1", subtask: "Conduct integration workshop (all TWGs + internal)", deadline: "Month 9", estHours: 90, lead: "Internal + TWG" },
      { id: "8.2", subtask: "Align outputs across workstreams (data, frameworks, classification, equations)", deadline: "Month 9", estHours: 90, lead: "Internal + TWG" },
      { id: "8.3", subtask: "Resolve gaps and inconsistencies", deadline: "Month 9", estHours: 80, lead: "Internal + TWG" },
    ]
  },
  {
    id: "Task 9",
    title: "Matrix Options Paper (Final) and Phase 2 Deliverables",
    subtasks: [
      { id: "9.1", subtask: "Draft final Matrix Options Paper (research findings, options considered, rationale, recommendations, engagement summary)", deadline: "Month 10-11", estHours: 120, lead: "Internal + TWG" },
      { id: "9.2", subtask: "Full TWG and SSTAC review; internal revisions", deadline: "Month 11", estHours: 100, lead: "Internal + TWG" },
      { id: "9.3", subtask: "Finalize Matrix Options Paper and deliverables package", deadline: "Month 12", estHours: 80, lead: "Internal + TWG" },
    ]
  },
  {
    id: "Task 10",
    title: "Phase 2 Project Management",
    subtasks: [
      { id: "10.1", subtask: "Planning", deadline: "Ongoing", estHours: 80, lead: "ENV + SABCS/SSTAC" },
      { id: "10.2", subtask: "Coordination", deadline: "Ongoing", estHours: 80, lead: "ENV + SABCS/SSTAC" },
      { id: "10.3", subtask: "Review (non-specific)", deadline: "Ongoing", estHours: 75, lead: "ENV + SABCS/SSTAC" },
      { id: "10.4", subtask: "Communications", deadline: "Ongoing", estHours: 80, lead: "ENV + SABCS/SSTAC" },
    ]
  }
];
