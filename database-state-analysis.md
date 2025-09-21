# 📊 Database State Analysis

## 🔍 Current Poll System State (Based on CSV Exports)

### **Polls Table Analysis (17 rows)**

#### ✅ **Valid Current Polls (Should Keep)**
- **Holistic Protection**: 2 polls (CEW + Survey versions)
  - `0907d8fb-5a8c-4607-9b44-12d38165ecf9` - CEW holistic-protection, poll_index 0
  - `25095a77-c59b-4384-85e3-df10c00037a0` - Survey holistic-protection, poll_index 0
- **Tiered Framework**: 1 poll (Survey version only - missing CEW version)
  - `0e507a8a-c277-4625-896f-2964b7f6481a` - Survey tiered-framework, poll_index 0
- **Prioritization**: 2 polls (Survey + CEW versions)
  - `291ac86a-1092-490a-9d29-be1bc2b08378` - Survey prioritization, poll_index 3
  - `9c7d2091-4622-4681-824a-44407dc1a9a8` - CEW prioritization, poll_index 3
  - `a32e1bfe-fc4e-4659-8eea-092f31aa04e4` - Survey prioritization, poll_index 7
  - `eefb6772-f317-4029-adfa-a696148bf589` - CEW prioritization, poll_index 7

#### ❌ **Outdated/Invalid Polls (Should Remove)**
- **WIKS Polls**: 6 polls (all should be removed)
  - `20ed70ae-2750-4434-8cd3-eb12666f2b79` - /wiks, poll_index 1
  - `2dc0041e-bb94-42e9-a107-de8fddf6d5a2` - /wiks, poll_index 0
  - `71157747-3989-4ff7-b4d6-719ede3aa4da` - /cew-polls/wiks, poll_index 2
  - `a2ad8d22-ad01-4d15-a792-8a84fbc22185` - /cew-polls/wiks, poll_index 1
  - `b79dec67-f32b-4338-8774-683fbce4cdb8` - /wiks, poll_index 2
  - `d407a4af-a0c6-455f-aa47-94a75251b2bb` - /cew-polls/wiks, poll_index 0
- **Test Poll**: 1 poll
  - `93bc87db-6b7b-46d5-8c5f-26157837495d` - /test, poll_index 0
- **Ranking Questions in Wrong Table**: 2 polls (should be in ranking_polls table)
  - `93c336b7-7ac3-4277-be8c-bfc5678de5f6` - Survey holistic-protection, poll_index 1 (ranking question)
  - Missing: Tiered Framework ranking question (poll_index 1)

### **Poll Votes Table Analysis (362 rows)**

#### 📊 **Vote Distribution by Poll ID**
- **WIKS Poll Votes**: ~340 votes (majority of votes)
  - `d407a4af-a0c6-455f-aa47-94a75251b2bb` (WIKS CEW poll_index 0): ~100 votes
  - `a2ad8d22-ad01-4d15-a792-8a84fbc22185` (WIKS CEW poll_index 1): ~100 votes  
  - `71157747-3989-4ff7-b4d6-719ede3aa4da` (WIKS CEW poll_index 2): ~100 votes
- **Valid Poll Votes**: ~22 votes
  - `0907d8fb-5a8c-4607-9b44-12d38165ecf9` (Holistic CEW): 1 vote
  - `f22ea5ae-68f9-49e8-8131-5d5ab6806fc6` (Tiered CEW): 1 vote
  - `9c7d2091-4622-4681-824a-44407dc1a9a8` (Prioritization CEW): 1 vote
  - `eefb6772-f317-4029-adfa-a696148bf589` (Prioritization CEW): 1 vote
  - Various TWG/SSTAC votes: ~18 votes

#### 🚨 **Critical Issues Identified**

1. **WIKS Polls Still Active**: 6 WIKS polls exist with ~340 votes
2. **Missing Polls**: 
   - Missing CEW Tiered Framework poll_index 0 (single-choice)
   - Missing Survey Tiered Framework poll_index 1 (ranking)
   - Missing CEW Tiered Framework poll_index 1 (ranking)
   - Missing most Prioritization polls (only 2 of 8 exist)
3. **Ranking Question in Wrong Table**: 
   - `93c336b7-7ac3-4277-be8c-bfc5678de5f6` is a ranking question stored in `polls` table
4. **Test Data Present**: 1 test poll exists

## 🎯 **Required Actions**

### **Phase 1: Remove Outdated Data**
1. Delete all WIKS polls (6 polls) and their ~340 votes
2. Delete test poll and its votes
3. Move ranking question from `polls` to `ranking_polls` table

### **Phase 2: Create Missing Polls**
1. Create missing CEW Tiered Framework single-choice poll
2. Create missing Survey Tiered Framework ranking poll  
3. Create missing CEW Tiered Framework ranking poll
4. Create missing 6 Prioritization polls (both CEW and Survey versions)

### **Phase 3: Verify Data Integrity**
1. Ensure all current page questions have corresponding database polls
2. Verify vote counts match between pages and database
3. Test admin panel functionality

## 📈 **Expected Final State**
- **Polls Table**: ~20 polls (10 single-choice polls for current questions)
- **Ranking Polls Table**: ~10 polls (10 ranking polls for current questions)  
- **Poll Votes**: ~22 votes (only valid votes remaining)
- **Ranking Votes**: Existing ranking votes preserved

## ⚠️ **Risk Assessment**
- **HIGH RISK**: Removing ~340 votes (majority of current data)
- **MEDIUM RISK**: Moving ranking question between tables
- **LOW RISK**: Creating missing polls (additive operation)

## 🛡️ **Safeguards Required**
1. **Comprehensive Backup**: All tables before any changes
2. **Step-by-step Execution**: One operation at a time with verification
3. **Rollback Plan**: Ability to restore from backup if issues arise
4. **User Approval**: Explicit approval for each phase before execution
