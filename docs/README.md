# 📚 Documentation Index

Complete documentation for the SSTAC & TWG Dashboard project.

## 🗺️ **Documentation Map**

### **🔰 Start Here**

New to the project? Read these in order:

1. **[Main README](../README.md)** - Project overview and quick start
2. **[Project Status](PROJECT_STATUS.md)** - Current features and capabilities
3. **[Core Guidelines](AGENTS.md)** - Essential development rules

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
- Current project state (PRODUCTION READY)
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

## 🎯 **Technical Guides**

### **[POLL_SYSTEM_COMPLETE_GUIDE.md](POLL_SYSTEM_COMPLETE_GUIDE.md)** - Poll System Architecture
**Who needs this**: Developers working on polls

**Contents:**
- Three separate poll systems explained
- Database schema details
- Vote counting logic
- Question synchronization rules
- CEW vs survey differences

**Key sections:**
- Single-choice polls (polls table)
- Ranking polls (ranking_polls table)
- Wordcloud polls (wordcloud_polls table)
- Matrix graph system
- Verification queries

**When to reference:**
- Adding new polls
- Modifying poll behavior
- Debugging vote counting
- Understanding data flow

---

### **[POLL_SYSTEM_DEBUGGING_GUIDE.md](POLL_SYSTEM_DEBUGGING_GUIDE.md)** - Debugging Procedures
**Who needs this**: Anyone troubleshooting issues

**Contents:**
- Common debugging scenarios
- Resolution procedures
- SQL diagnostic queries
- Troubleshooting workflows

**Key sections:**
- Vote counting errors
- Path recognition issues
- TypeScript build failures
- Array indexing bugs
- Matrix graph issues

**When to reference:**
- When something breaks
- Before making complex changes
- When tests fail
- Investigating data issues

---

### **[DEBUGGING_LESSONS_LEARNED.md](DEBUGGING_LESSONS_LEARNED.md)** - Historical Issues
**Who needs this**: All developers

**Contents:**
- Comprehensive debugging scenarios
- Root cause analysis
- Bad assumptions documented
- Prevention protocols

**Key sections:**
- Question text synchronization
- Admin panel matching failures
- K6 test user ID mismatch
- Wordcloud UX improvements
- Filter system inconsistencies

**When to reference:**
- Before repeating past mistakes
- Understanding system quirks
- Learning from history
- Preventing known issues

---

### **[SAFE_POLL_UPDATE_PROTOCOL.md](SAFE_POLL_UPDATE_PROTOCOL.md)** - Update Procedures
**Who needs this**: Anyone modifying polls

**Contents:**
- Pre-update checklist
- Safe update procedures
- Three-way synchronization
- Rollback procedures

**Key sections:**
- Single-choice poll updates
- Ranking poll updates
- Wordcloud poll updates
- Emergency rollback
- Verification procedures

**When to reference:**
- Before updating polls
- Adding new questions
- Modifying question text
- Changing poll options

---

### **[K6_TEST_COVERAGE_ANALYSIS.md](K6_TEST_COVERAGE_ANALYSIS.md)** - Testing Documentation
**Who needs this**: Developers, QA

**Contents:**
- Test coverage assessment
- Test execution commands
- Performance metrics
- Coverage gaps analysis

**Key sections:**
- Current test coverage
- Enhanced test suite
- Matrix graph testing
- Execution strategy

**When to reference:**
- Running performance tests
- Adding new tests
- Checking coverage
- Pre-deployment validation

---

### **[MATRIX_GRAPH_VISUALIZATION.md](MATRIX_GRAPH_VISUALIZATION.md)** - Visualization Guide
**Who needs this**: Frontend developers

**Contents:**
- Overlapping data points solution
- 4-mode visualization system
- Implementation details
- Usage examples

**Key sections:**
- Jittered mode
- Size-scaled mode
- Heatmap mode
- Concentric mode
- Best practices

**When to reference:**
- Working on matrix graphs
- Handling data clustering
- Implementing visualizations
- Testing graph modes

---

## 🔍 **Quick Reference**

### **Common Tasks**

| Task | Documentation | Script/Command |
|------|---------------|----------------|
| Add new poll | [Poll System Guide](POLL_SYSTEM_COMPLETE_GUIDE.md) | [Update Protocol](SAFE_POLL_UPDATE_PROTOCOL.md) |
| Debug vote counting | [Debugging Guide](POLL_SYSTEM_DEBUGGING_GUIDE.md) | [Debug Scripts](../scripts/debug/) |
| Run tests | [Test Coverage](K6_TEST_COVERAGE_ANALYSIS.md) | [Test Scripts](../tests/) |
| Update questions | [Update Protocol](SAFE_POLL_UPDATE_PROTOCOL.md) | [Cleanup Scripts](../scripts/cleanup/) |
| Fix matrix graphs | [Matrix Guide](MATRIX_GRAPH_VISUALIZATION.md) | [Matrix Debug](../scripts/debug/) |
| Review guidelines | [AGENTS.md](AGENTS.md) | N/A |

---

## 🎓 **Learning Paths**

### **Path 1: New Developer Onboarding**

1. Read [Main README](../README.md) - Get project overview
2. Read [Project Status](PROJECT_STATUS.md) - Understand current state
3. Read [AGENTS.md](AGENTS.md) - Learn core rules
4. Read [Poll System Guide](POLL_SYSTEM_COMPLETE_GUIDE.md) - Understand architecture
5. Run basic tests - [Tests README](../tests/README.md)

**Time**: 2-3 hours  
**Outcome**: Ready to contribute

---

### **Path 2: Poll System Developer**

1. Read [Poll System Guide](POLL_SYSTEM_COMPLETE_GUIDE.md) - Complete
2. Read [Update Protocol](SAFE_POLL_UPDATE_PROTOCOL.md) - Complete
3. Read [Debugging Guide](POLL_SYSTEM_DEBUGGING_GUIDE.md) - Skim
4. Review [Lessons Learned](DEBUGGING_LESSONS_LEARNED.md) - Key scenarios
5. Practice with test polls

**Time**: 3-4 hours  
**Outcome**: Can safely modify polls

---

### **Path 3: Debugging Specialist**

1. Read [Debugging Guide](POLL_SYSTEM_DEBUGGING_GUIDE.md) - Complete
2. Read [Lessons Learned](DEBUGGING_LESSONS_LEARNED.md) - Complete
3. Learn SQL debug scripts - [Scripts README](../scripts/README.md)
4. Practice with test scenarios
5. Review past issues in guides

**Time**: 4-5 hours  
**Outcome**: Can troubleshoot complex issues

---

### **Path 4: Frontend Developer**

1. Read [Main README](../README.md) - Overview
2. Read [AGENTS.md](AGENTS.md) - Core rules
3. Read [Matrix Graph Guide](MATRIX_GRAPH_VISUALIZATION.md) - Complete
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

2. **[Poll System Guide](POLL_SYSTEM_COMPLETE_GUIDE.md)** - Section: "Key System Rules"
   - Never mix poll types
   - Question synchronization
   - Vote storage rules

3. **[Update Protocol](SAFE_POLL_UPDATE_PROTOCOL.md)** - Section: "Safety Guidelines"
   - Backup procedures
   - Three-way synchronization
   - Rollback procedures

---

## 🚨 **Emergency Procedures**

### **System Down**
1. Check [Debugging Guide](POLL_SYSTEM_DEBUGGING_GUIDE.md) - "Common Issues"
2. Run [Debug Scripts](../scripts/debug/)
3. Review recent changes in git
4. Contact team lead

### **Data Loss**
1. Stop all operations
2. Check backups: [Scripts README](../scripts/README.md)
3. Follow rollback: [Update Protocol](SAFE_POLL_UPDATE_PROTOCOL.md)
4. Document incident: [Lessons Learned](DEBUGGING_LESSONS_LEARNED.md)

### **Build Failure**
1. Check [Debugging Guide](POLL_SYSTEM_DEBUGGING_GUIDE.md) - "TypeScript Issues"
2. Review linting errors
3. Check recent changes
4. Run `npm run build` for details

---

## 📊 **Documentation Statistics**

| Document | Size | Sections | Last Updated |
|----------|------|----------|--------------|
| AGENTS.md | 43 KB | 25+ | Sep 2024 |
| PROJECT_STATUS.md | 35 KB | 20+ | Jan 2025 |
| POLL_SYSTEM_COMPLETE_GUIDE.md | 25 KB | 15+ | Jan 2025 |
| POLL_SYSTEM_DEBUGGING_GUIDE.md | 40 KB | 30+ | Jan 2025 |
| DEBUGGING_LESSONS_LEARNED.md | 17 KB | 10+ | Jan 2025 |
| SAFE_POLL_UPDATE_PROTOCOL.md | 12 KB | 8+ | Jan 2025 |
| K6_TEST_COVERAGE_ANALYSIS.md | 12 KB | 10+ | Jan 2025 |
| MATRIX_GRAPH_VISUALIZATION.md | 11 KB | 12+ | Jan 2025 |

**Total**: ~195 KB of documentation  
**Coverage**: Comprehensive across all systems

---

## 🔄 **Documentation Maintenance**

### **Keeping Docs Updated**

1. **After any major change:**
   - Update relevant guide
   - Update PROJECT_STATUS.md
   - Update this index if needed

2. **After debugging session:**
   - Add to DEBUGGING_LESSONS_LEARNED.md
   - Update POLL_SYSTEM_DEBUGGING_GUIDE.md
   - Document prevention measures

3. **After adding features:**
   - Update AGENTS.md if core rules change
   - Update POLL_SYSTEM_COMPLETE_GUIDE.md
   - Update PROJECT_STATUS.md

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

**Last Updated**: October 2025  
**Maintained By**: SSTAC Dashboard Team  
**Documentation Coverage**: 100% of core systems  
**Total Documentation**: 8 comprehensive guides

