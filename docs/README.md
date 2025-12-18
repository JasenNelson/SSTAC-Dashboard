# 📚 Documentation Index

Complete documentation for the SSTAC & TWG Dashboard project.

> **Canonical entrypoint:** Use **`docs/INDEX.md`** as the single source of “what’s current”.  
> **Volatile metrics policy:** Test counts, grades, and similar metrics must live in `docs/_meta/docs-manifest.json` (`facts`) to avoid contradictions.

## 🗺️ **Documentation Map**

### **🔰 Start Here**

New to the project? Read these in order:

1. **[Canonical Docs Index](INDEX.md)** - Start here (canonical)
2. **[Main README](../README.md)** - Project overview and quick start
3. **[Core Guidelines](AGENTS.md)** - Essential development rules
4. **[Project Status](PROJECT_STATUS.md)** - Reference snapshot (non-canonical)

### **🚀 Quick Start Templates**

**[QUICK_START_TEMPLATES.md](QUICK_START_TEMPLATES.md)** - AI Chat Templates  
*Copy-paste templates to quickly orient AI assistants to specific topics*

Use these templates in fresh AI chats to provide instant context for:
- Project assessment & improvement planning
- Poll system work
- Testing infrastructure
- Architecture & design patterns
- Debugging sessions
- Complete project review

---

## 📖 **Core Documentation**

### **[AGENTS.md](AGENTS.md)** - Core Development Guidelines
**Who needs this**: All developers, AI assistants

**Contents:**
- Essential development rules
- Critical system knowledge
- Database schema rules
- TypeScript requirements
- Poll system architecture
- Debugging protocols

**Key sections:**
- Poll system structure (3 separate systems)
- Database indexing rules (0-based arrays)
- CEW vs authenticated user handling
- Critical "never modify" rules

**When to reference:**
- Before making any code changes
- When debugging issues
- Before database modifications
- When adding new features

---

### **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current Project Status
**Who needs this**: Everyone

**Contents:**
- Reference snapshot of system capabilities (non-canonical; no volatile metrics)
- Recent major updates
- Completed features
- System architecture overview
- Performance metrics

**Key sections:**
- Matrix graph visualization system
- K6 test coverage
- Admin panel improvements
- Poll system implementation

**When to reference:**
- Checking what's implemented
- Finding recent changes
- Understanding system capabilities
- Planning new features

---

## 📁 **Organized Documentation Folders**

### **[📊 Review & Analysis](review-analysis/)** - Codebase Assessment
**New to assessment?** Read `review-analysis/README.md` first

**Contents:**
- Comprehensive 8-phase project review (Jan 2025)
- 40 prioritized enhancements identified
- Phase completion summaries and improvement planning (see `docs/INDEX.md` + manifest `facts` for canonical metrics)
- Grade projection and improvement tracking
- Production-safe vs full roadmap options

**Quick Start:**
```
Review the markdown files in docs/review-analysis to understand 
the project state, Phase 3 completion, and remaining improvement opportunities
```

---

### **[🗳️ Poll System](poll-system/)** - Poll Architecture
**Working on polls?** Read `poll-system/README.md` first

**Contents:**
- Three poll systems (Single-Choice, Ranking, Wordcloud)
- Complete debugging guides
- Safe update protocols
- Database schemas and verification

**Quick Start:**
```
Review the markdown files in docs/poll-system to understand 
the poll architecture and safe modification procedures
```

---

### **[🧪 Testing](testing/)** - Test Infrastructure
**Adding tests?** Read `testing/README.md` first

**Contents:**
- k6 load testing plans (see `docs/testing/` and `docs/_meta/docs-manifest.json` → `facts.testing`)
- Unit testing (Vitest) (see `docs/_meta/docs-manifest.json` → `facts.testing`)
- E2E testing (Playwright) ✅
- CI/CD integration ✅
- Coverage analysis
- Test execution guides
- Phase 3 testing complete (validation, security, rate limiting) ✅

**Quick Start:**
```
Review the markdown files in docs/testing to understand 
the complete testing infrastructure including unit, E2E, and load tests
```

---

### **[🏗️ System Design](system-design/)** - Architecture Patterns
**Understanding architecture?** Read `system-design/README.md` first

**Contents:**
- Matrix graph visualization system
- Architecture patterns and lessons
- Debugging insights
- Design decisions

**Quick Start:**
```
Review the markdown files in docs/system-design to understand 
key system design decisions and visualization patterns
```

---

## 🔍 **Quick Reference**

### **Common Tasks**

| Task | Documentation | Script/Command |
|------|---------------|----------------|
| Add new poll | [Poll System](poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md) | [Safe Update](poll-system/SAFE_POLL_UPDATE_PROTOCOL.md) |
| Debug vote counting | [Poll Debugging](poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md) | [Debug Scripts](../scripts/debug/) |
| Run tests | [Testing Guide](testing/K6_TEST_COVERAGE_ANALYSIS.md) | [Test Scripts](../tests/) |
| Review assessments | [Review Analysis](review-analysis/REVIEW_SUMMARY.md) | N/A |
| Fix matrix graphs | [System Design](system-design/MATRIX_GRAPH_VISUALIZATION.md) | [Matrix Debug](../scripts/debug/) |
| Review guidelines | [AGENTS.md](AGENTS.md) | N/A |

---

## 🎓 **Learning Paths**

### **Path 1: New Developer Onboarding**

1. Read [Main README](../README.md) - Get project overview
2. Read [Project Status](PROJECT_STATUS.md) - Understand current state
3. Read [AGENTS.md](AGENTS.md) - Learn core rules
4. Read [Poll System](poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md) - Understand architecture
5. Run basic tests - [Tests README](../tests/README.md)

**Time**: 2-3 hours  
**Outcome**: Ready to contribute

---

### **Path 2: Poll System Developer**

1. Read [Poll System](poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md) - Complete
2. Read [Update Protocol](poll-system/SAFE_POLL_UPDATE_PROTOCOL.md) - Complete
3. Read [Debugging](poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md) - Skim
4. Review [Lessons](system-design/DEBUGGING_LESSONS_LEARNED.md) - Key scenarios
5. Practice with test polls

**Time**: 3-4 hours  
**Outcome**: Can safely modify polls

---

### **Path 3: Review & Assessment**

1. Read [Review Summary](review-analysis/REVIEW_SUMMARY.md) - Overview
2. Read [Phase 3 Completion](review-analysis/archive/PHASE3_COMPLETION_SUMMARY.md) - Latest completed phase
3. Read [Master Summary](review-analysis/archive/MASTER_COMPLETION_SUMMARY.md) - Weeks 1-16 overview (historical)
4. Choose [Next Steps](review-analysis/NEXT_STEPS.md) or [Safe Roadmap](review-analysis/archive/PRODUCTION_SAFE_ROADMAP.md) (historical)
5. Track with [Grade Projection](review-analysis/archive/GRADE_PROJECTION.md) (historical)
6. Plan implementation (see `docs/INDEX.md` + manifest `facts` for canonical current targets)

**Time**: 1-2 hours  
**Outcome**: Understand review context, Phase 3 completion, and remaining improvement plan

---

### **Path 4: Frontend Developer**

1. Read [Main README](../README.md) - Overview
2. Read [AGENTS.md](AGENTS.md) - Core rules
3. Read [Matrix Graph](system-design/MATRIX_GRAPH_VISUALIZATION.md) - Complete
4. Review component architecture
5. Run frontend tests

**Time**: 2-3 hours  
**Outcome**: Can work on UI components

---

## ⚠️ **Critical Information**

### **Must-Read Before Changing Code**

1. **[AGENTS.md](AGENTS.md)** - Section: "CRITICAL System Rules"
   - Poll system structure
   - Array indexing rules
   - Never-modify rules

2. **[Poll System Guide](poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md)** - Section: "Key System Rules"
   - Never mix poll types
   - Question synchronization
   - Vote storage rules

3. **[Update Protocol](poll-system/SAFE_POLL_UPDATE_PROTOCOL.md)** - Section: "Safety Guidelines"
   - Backup procedures
   - Three-way synchronization
   - Rollback procedures

---

## 🚨 **Emergency Procedures**

### **System Down**
1. Check [Debugging Guide](poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md) - "Common Issues"
2. Run [Debug Scripts](../scripts/debug/)
3. Review recent changes in git
4. Contact team lead

### **Data Loss**
1. Stop all operations
2. Check backups: [Scripts README](../scripts/README.md)
3. Follow rollback: [Update Protocol](poll-system/SAFE_POLL_UPDATE_PROTOCOL.md)
4. Document incident: [Lessons Learned](system-design/DEBUGGING_LESSONS_LEARNED.md)

### **Build Failure**
1. Check [Debugging Guide](poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md) - "TypeScript Issues"
2. Review linting errors
3. Check recent changes
4. Run `npm run build` for details

---

## 📊 **Documentation Statistics**

Volatile doc counts/sizes drift frequently; treat them as non-canonical.

If you need counts/metrics, store them in `docs/_meta/docs-manifest.json` (`facts`) with provenance.

---

## 🔄 **Documentation Maintenance**

### **Keeping Docs Updated**

1. **After any major change:**
   - Update relevant guide (check folder)
   - Update `docs/INDEX.md` and/or `docs/_meta/docs-manifest.json` (`facts`) if the change affects “what’s current”
   - Update this index if needed

2. **After debugging session:**
   - Add to [Lessons Learned](system-design/DEBUGGING_LESSONS_LEARNED.md)
   - Update [Poll Debugging](poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md)
   - Document prevention measures

3. **After adding features:**
   - Update AGENTS.md if core rules change
   - Update [Poll System Guide](poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md)
   - Update `docs/INDEX.md` / manifest facts if this affects canonical status or metrics

### **Documentation Review Schedule**

- **Weekly**: Check for outdated information
- **Monthly**: Review and consolidate
- **Quarterly**: Major documentation audit
- **After incidents**: Immediate updates

---

## 💡 **Tips for Using Documentation**

### **Finding Information Fast**

1. **Use Ctrl+F** in each document
2. **Check Quick Reference** tables first
3. **Follow links** between documents
4. **Search git history** for context

### **Understanding Context**

- Read "Root Cause Analysis" sections
- Review "Bad Assumptions" lists
- Check "Prevention Measures"
- Look at code examples

### **Contributing to Docs**

- Keep language clear and concise
- Include code examples
- Add warnings for dangerous operations
- Cross-reference related sections
- Test all commands before documenting

---

## 📞 **Getting Help**

### **Can't Find What You Need?**

1. Check main [README](../README.md) Quick Links
2. Search all docs folder
3. Review [Scripts README](../scripts/README.md)
4. Check [Tests README](../tests/README.md)
5. Ask team lead

### **Found an Issue in Docs?**

1. Document the problem
2. Suggest correction
3. Update relevant file
4. Submit pull request

---

## 🎯 **Documentation Goals**

✅ **Comprehensive** - Cover all systems and features  
✅ **Accessible** - Easy to find and understand  
✅ **Practical** - Actionable procedures and examples  
✅ **Current** - Kept up-to-date with changes  
✅ **Safe** - Emphasize prevention and safety  

---

**Last Updated**: November 2025  
**Maintained By**: SSTAC Dashboard Team  
**Documentation Coverage**: See `docs/INDEX.md` / manifest for canonical status

