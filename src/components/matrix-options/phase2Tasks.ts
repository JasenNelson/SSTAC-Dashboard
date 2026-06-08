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
    title: "Options Paper Review and Finalization",
    subtasks: [
      {
        id: "1.1",
        subtask: "Circulate draft Options Paper (focus Sections 4 & 7)",
        deadline: "Week 0",
        estHours: 4,
        lead: "Internal"
      },
      {
        id: "1.2",
        subtask: "Internal review period",
        deadline: "Week 2",
        estHours: 40,
        lead: "Internal"
      },
      {
        id: "1.3",
        subtask: "Compile and synthesize comments",
        deadline: "Week 3",
        estHours: 20,
        lead: "Internal"
      },
      {
        id: "1.4",
        subtask: "Revise Options Paper (technical + policy alignment)",
        deadline: "Week 6",
        estHours: 60,
        lead: "Internal"
      }
    ]
  },
  {
    id: "Task 2",
    title: "Project Mobilization and Governance Setup",
    subtasks: [
      {
        id: "2.1",
        subtask: "Confirm TWG structure and mandates (Bioavailability, Bioaccumulation, Data, Framework)",
        deadline: "Month 2",
        estHours: 12,
        lead: "Internal"
      },
      {
        id: "2.2",
        subtask: "Confirm TWG membership and resourcing",
        deadline: "Month 2",
        estHours: 12,
        lead: "Internal"
      },
      {
        id: "2.3",
        subtask: "Develop TWG charters (scope, deliverables, timelines)",
        deadline: "Month 2",
        estHours: 20,
        lead: "Internal"
      },
      {
        id: "2.4",
        subtask: "Develop detailed TWG workplans",
        deadline: "Month 2",
        estHours: 40,
        lead: "Internal + TWG Leads"
      }
    ]
  },
  {
    id: "Task 3",
    title: "Data Compilation and Evidence Base",
    subtasks: [
      {
        id: "3.1",
        subtask: "Define scope of data compilation (parameters, endpoints, media)",
        deadline: "Month 3",
        estHours: 30,
        lead: "TWG"
      },
      {
        id: "3.2",
        subtask: "Design database structure (BC aquatic/sediment database)",
        deadline: "Month 3",
        estHours: 50,
        lead: "TWG"
      },
      {
        id: "3.3",
        subtask: "Conduct desktop data compilation (literature, reports, datasets)",
        deadline: "Months 4-6",
        estHours: 200,
        lead: "TWG"
      },
      {
        id: "3.4",
        subtask: "QA/QC and data usability screening",
        deadline: "Month 6",
        estHours: 40,
        lead: "TWG"
      },
      {
        id: "3.5",
        subtask: "Deliver BC sediment/aquatic data inventory",
        deadline: "Month 6",
        estHours: 20,
        lead: "TWG"
      }
    ]
  },
  {
    id: "Task 4",
    title: "Bioavailability Framework Development",
    subtasks: [
      {
        id: "4.1",
        subtask: "Review applicable approaches (EqP, AVS/SEM, TOC normalization)",
        deadline: "Month 3-4",
        estHours: 60,
        lead: "TWG"
      },
      {
        id: "4.2",
        subtask: "Assess applicability to BC sediment types",
        deadline: "Month 4",
        estHours: 40,
        lead: "TWG"
      },
      {
        id: "4.3",
        subtask: "Identify data requirements and constraints",
        deadline: "Month 4",
        estHours: 20,
        lead: "TWG"
      },
      {
        id: "4.4",
        subtask: "Draft BC bioavailability framework approach",
        deadline: "Month 5",
        estHours: 50,
        lead: "TWG"
      },
      {
        id: "4.5",
        subtask: "Internal technical review",
        deadline: "Month 6",
        estHours: 20,
        lead: "Internal + TWG"
      }
    ]
  },
  {
    id: "Task 5",
    title: "Bioaccumulation and Substance Classification",
    subtasks: [
      {
        id: "5.1",
        subtask: "Review BSAF approaches and jurisdictional practices",
        deadline: "Month 4",
        estHours: 50,
        lead: "TWG"
      },
      {
        id: "5.2",
        subtask: "Develop classification criteria (biomagnification, persistence, toxicity)",
        deadline: "Month 5",
        estHours: 60,
        lead: "TWG"
      },
      {
        id: "5.3",
        subtask: "Develop preliminary substance prioritization framework",
        deadline: "Month 6",
        estHours: 60,
        lead: "Internal + TWG"
      },
      {
        id: "5.4",
        subtask: "Validate against BC occurrence data",
        deadline: "Month 6",
        estHours: 40,
        lead: "TWG"
      },
      {
        id: "5.5",
        subtask: "Produce classification framework document",
        deadline: "Month 6",
        estHours: 20,
        lead: "TWG"
      }
    ]
  },
  {
    id: "Task 6",
    title: "Matrix Framework Design (Multi-Pathway Integration)",
    subtasks: [
      {
        id: "6.1",
        subtask: "Define structure for four pathways (eco direct, eco food, HH direct, HH food)",
        deadline: "Month 5",
        estHours: 40,
        lead: "TWG"
      },
      {
        id: "6.2",
        subtask: "Define Tier 0 / Tier 1 / Tier 2 triggers and decision logic",
        deadline: "Month 5",
        estHours: 40,
        lead: "TWG"
      },
      {
        id: "6.3",
        subtask: "Integrate Indigenous consumption modifiers and high-use scenarios",
        deadline: "Month 5-6",
        estHours: 30,
        lead: "TWG"
      },
      {
        id: "6.4",
        subtask: "Draft integrated matrix framework architecture",
        deadline: "Month 6",
        estHours: 60,
        lead: "TWG"
      },
      {
        id: "6.5",
        subtask: "Internal review and refinement",
        deadline: "Month 6",
        estHours: 30,
        lead: "Internal"
      }
    ]
  },
  {
    id: "Task 7",
    title: "Schedule 3.4 Expansion Concept (Policy Integration)",
    subtasks: [
      {
        id: "7.1",
        subtask: "Define scope of Schedule 3.4 expansion (pathways + substances)",
        deadline: "Month 5",
        estHours: 20,
        lead: "Internal"
      },
      {
        id: "7.2",
        subtask: "Align matrix framework outputs with CSR structure",
        deadline: "Month 6",
        estHours: 30,
        lead: "Internal"
      },
      {
        id: "7.3",
        subtask: "Develop concept for multi-pathway standards structure",
        deadline: "Month 6",
        estHours: 30,
        lead: "Internal"
      },
      {
        id: "7.4",
        subtask: "Draft policy-ready outline for future regulatory integration",
        deadline: "Month 6",
        estHours: 40,
        lead: "Internal"
      },
      {
        id: "7.5",
        subtask: "Internal policy/legal review",
        deadline: "Month 7",
        estHours: 20,
        lead: "Internal"
      }
    ]
  },
  {
    id: "Task 8",
    title: "Integration and Synthesis",
    subtasks: [
      {
        id: "8.1",
        subtask: "Conduct integration workshop (all TWGs + internal)",
        deadline: "Month 7",
        estHours: 40,
        lead: "Internal + TWG"
      },
      {
        id: "8.2",
        subtask: "Align outputs across workstreams (data, frameworks, classification)",
        deadline: "Month 7",
        estHours: 50,
        lead: "Internal"
      },
      {
        id: "8.3",
        subtask: "Resolve gaps and inconsistencies",
        deadline: "Month 7",
        estHours: 40,
        lead: "Internal"
      }
    ]
  },
  {
    id: "Task 9",
    title: "Phase 2 Reporting and Deliverables",
    subtasks: [
      {
        id: "9.1",
        subtask: "Draft Phase 2 summary report",
        deadline: "Month 8",
        estHours: 80,
        lead: "Internal"
      },
      {
        id: "9.2",
        subtask: "Internal review and revisions",
        deadline: "Month 9",
        estHours: 60,
        lead: "Internal"
      },
      {
        id: "9.3",
        subtask: "Finalize deliverables package",
        deadline: "Month 9",
        estHours: 20,
        lead: "Internal"
      }
    ]
  }
];
