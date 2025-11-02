# Poll System Documentation

**Purpose:** Comprehensive guides for the three poll systems (Single-Choice, Ranking, Wordcloud)

---

## 📋 Overview

The SSTAC Dashboard implements three separate poll systems, each with unique vote storage and processing logic. This folder contains complete documentation for development, debugging, and safe modification.

---

## 📚 Document Index

### **🎯 Start Here**

**[POLL_SYSTEM_COMPLETE_GUIDE.md](POLL_SYSTEM_COMPLETE_GUIDE.md)** - Complete System Guide  
*Comprehensive documentation for all three poll systems, architecture, and workflows*

---

### **🔧 Development & Debugging**

**[POLL_SYSTEM_DEBUGGING_GUIDE.md](POLL_SYSTEM_DEBUGGING_GUIDE.md)** - Debugging Guide  
*Common issues, troubleshooting steps, and diagnostic procedures*

**[SAFE_POLL_UPDATE_PROTOCOL.md](SAFE_POLL_UPDATE_PROTOCOL.md)** - Safe Modification Protocol  
*Step-by-step process for making changes without breaking existing polls*

---

## 🎯 When to Use These Documents

### **Understanding Poll System**
```
Review the markdown files in docs/poll-system to understand the three poll 
systems (Single-Choice, Ranking, Wordcloud), their database schemas, 
component architecture, and voting workflows.
```

### **Debugging Issues**
1. Read **POLL_SYSTEM_COMPLETE_GUIDE.md** for architecture
2. Check **POLL_SYSTEM_DEBUGGING_GUIDE.md** for known issues
3. Follow diagnostic steps for your specific problem

### **Making Changes**
1. Read **SAFE_POLL_UPDATE_PROTOCOL.md** completely
2. Check database schema impact
3. Verify test coverage
4. Follow deployment steps

---

## 🗄️ Database Schema

### **Single-Choice Polls**
- `polls` + `votes` + `poll_results` tables
- Vote storage: `option_id`, `option_text`

### **Ranking Polls**
- `ranking_polls` + `ranking_votes` + `ranking_results` tables
- Vote storage: `option_ids[]`, `option_texts[]`

### **Wordcloud Polls**
- `wordcloud_polls` + `wordcloud_votes` tables
- Vote storage: `words[]` (up to 5 entries)

---

## ⚠️ Critical Rules

1. **NEVER modify vote storage logic** - breaks existing votes
2. **0-based arrays** - Database stores arrays, not JSON
3. **Results calculation** - Maintain backward compatibility
4. **CEW vs Auth** - Different handling for anonymous/authenticated
5. **RLS policies** - Separate policies for each system

---

## 🔍 Quick Reference

### **Component Files**
- Single-Choice: `src/components/dashboard/PollResultsClient.tsx`
- Ranking: `src/components/dashboard/RankingPoll.tsx`
- Wordcloud: `src/components/dashboard/WordCloudPoll.tsx`

### **API Routes**
- Single-Choice: `/api/poll/submit`, `/api/poll-results`
- Ranking: `/api/ranking-poll/submit`, `/api/ranking-poll-results`
- Wordcloud: `/api/wordcloud-poll/submit`, `/api/wordcloud-poll-results`

### **Database Functions**
- Single-Choice: `calculate_poll_results`
- Ranking: `calculate_ranking_results`
- Wordcloud: (JavaScript calculation)

---

**All poll system documentation is production-tested and maintained.**

