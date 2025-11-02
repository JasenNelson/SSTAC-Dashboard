# System Design Documentation

**Purpose:** Architecture patterns, visualization guides, and lessons learned

---

## 📋 Overview

This folder contains documentation for key system design decisions, architectural patterns, visualization guides, and important debugging lessons that impact how the system is built and maintained.

---

## 📚 Document Index

### **🎯 Architecture & Design**

**[MATRIX_GRAPH_VISUALIZATION.md](MATRIX_GRAPH_VISUALIZATION.md)** - Matrix Graph Guide  
*Complete guide for the prioritization matrix graph visualization system*

**[PHASE2_MATRIX_GRAPH_ISSUE_RESOLUTION.md](PHASE2_MATRIX_GRAPH_ISSUE_RESOLUTION.md)** - Issue Resolution  
*Detailed analysis and solution for matrix graph pairing issues*

---

### **🔍 Lessons Learned**

**[DEBUGGING_LESSONS_LEARNED.md](DEBUGGING_LESSONS_LEARNED.md)** - Critical Lessons  
*Important debugging insights, patterns, and anti-patterns discovered during development*

---

## 🎯 When to Use These Documents

### **Understanding Matrix Graph**
```
Review the markdown files in docs/system-design to understand the 
matrix graph visualization system, its architecture, pairing logic, 
and how to safely modify or extend it.
```

### **Working with Matrix Graphs**
1. Read **MATRIX_GRAPH_VISUALIZATION.md** for architecture
2. Check **PHASE2_MATRIX_GRAPH_ISSUE_RESOLUTION.md** for known issues
3. Reference debugging lessons when troubleshooting

### **Learning from Experience**
- Review **DEBUGGING_LESSONS_LEARNED.md** before starting new features
- Understand common pitfalls and solutions
- Follow established patterns

---

## 🗺️ Matrix Graph System

### **Overview**
The Prioritization Matrix Graph is an interactive visualization that displays document relationships and priority rankings across two dimensions.

### **Key Components**
- **Frontend:** `src/components/dashboard/MatrixGraph.tsx`
- **API:** `/api/prioritization-matrix`
- **Storage:** Calculated on-the-fly from votes
- **Visualization:** D3.js interactive graph

### **Critical Features**
- **Pairing Logic:** 0-based array indexing
- **Session Management:** CEW vs authenticated users
- **Real-time Updates:** WebSocket-like polling
- **Priority Calculation:** Ranking-based scoring

---

## 🎓 Key Lessons

### **Database Indexing**
- **Rule:** Always use 0-based indexing for array operations
- **Reason:** PostgreSQL arrays and JavaScript align
- **Impact:** Incorrect indexing breaks pairing calculations

### **Session Management**
- **Pattern:** Different handling for anonymous (CEW) vs authenticated
- **Mechanism:** `x-session-id` header for CEW polling
- **Importance:** Prevents duplicate votes

### **Type Safety**
- **Requirement:** Use TypeScript interfaces, not `any`
- **Benefit:** Catches errors at compile time
- **Current Status:** 28 `any` types identified (needs reduction)

---

## 📊 Design Patterns Used

### **Consistent Patterns**
- Next.js App Router
- Supabase Auth integration
- RESTful API design
- RLS policies

### **Inconsistent Patterns (Needs Work)**
- State management (mix of useState, custom hooks, context)
- Error handling (inconsistent response formats)
- Data fetching (mix of SSR, client-side, server actions)
- Input validation (no centralized schemas)

See `docs/review-analysis/COMPREHENSIVE_REVIEW_PROGRESS.md` Phase 7 for full analysis.

---

## 🔍 Architecture Insights

### **Component Organization**
- Good separation of `components/`, `lib/`, `utils/`
- Some "god components" need refactoring
- Service layer extraction recommended

### **State Management**
- Local state for isolated components
- Context for global auth/admin state
- Opportunity for more standardized patterns

### **API Design**
- RESTful principles followed
- Consistent route naming
- Security gaps need attention

---

**System design documentation captures architectural decisions and important lessons for maintainability.**

