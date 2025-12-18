# 🚨 **CORRECTED K6 TESTING GUIDE - SSTAC DASHBOARD POLLING SYSTEMS**

## **CRITICAL ISSUE IDENTIFIED AND FIXED**

The original k6 test suite had **inconsistent user ID generation patterns** that broke most tests. This guide provides the **corrected approach** based on actual API behavior.

---

## **🔍 ROOT CAUSE ANALYSIS**

### **The Problem:**
- **Single-choice polls** expect `x-session-id` header for consistent user tracking
- **Ranking and wordcloud polls** ignore `x-session-id` and generate unique IDs per submission
- **Matrix graphs** require the SAME user ID for both questions in a pair
- **Original tests** were inconsistent about which approach to use

### **Why Matrix Graph Pairing Verification Works:**
- It only tests single-choice polls (Q1+Q2)
- Uses `x-session-id` header correctly
- Both questions get the same user ID: `${authCode}_${sessionId}`

### **Why Other Tests Failed:**
- They mixed different poll types with different user ID generation
- Ranking and wordcloud polls generate unique IDs per submission
- Matrix graphs can't pair votes from different user IDs

---

## **📊 POLLING SYSTEM ARCHITECTURE**

### **4 Poll Types & Their Characteristics:**

#### **1. Single-Choice Polls** ✅ **MATRIX GRAPH COMPATIBLE**
- **Database**: `polls` table → `poll_votes` table
- **API**: `POST /api/polls/submit`
- **User ID Generation**: `${authCode}_${sessionId}` (from `x-session-id` header)
- **Behavior**: One vote per user per poll (upsert on change)
- **Matrix Graphs**: ✅ **CAN be paired** (same session ID)

#### **2. Ranking Polls** ❌ **NOT MATRIX GRAPH COMPATIBLE**
- **Database**: `ranking_polls` table → `ranking_votes` table
- **API**: `POST /api/ranking-polls/submit`
- **User ID Generation**: `${authCode}_${timestamp}_${randomSuffix}` (unique per submission)
- **Behavior**: Multiple votes per user per poll (one per option with rank)
- **Matrix Graphs**: ❌ **CANNOT be paired** (unique user ID per submission)

#### **3. Wordcloud Polls** ❌ **NOT MATRIX GRAPH COMPATIBLE**
- **Database**: `wordcloud_polls` table → `wordcloud_votes` table
- **API**: `POST /api/wordcloud-polls/submit`
- **User ID Generation**: `${authCode}_${timestamp}_${randomSuffix}` (unique per submission)
- **Behavior**: Multiple words per user per poll (1-3 words, 20 char limit)
- **Matrix Graphs**: ❌ **CANNOT be paired** (unique user ID per submission)

#### **4. Matrix Graph System** ✅ **REQUIRES SINGLE-CHOICE POLLS**
- **API**: `GET /api/graphs/prioritization-matrix`
- **Data Source**: Paired votes from `poll_votes` table
- **Requirement**: Users must vote on BOTH questions in a pair
- **User ID**: **CRITICAL** - Must use same `x-session-id` for both votes
- **Question Pairs**: 0+1, 2+3, 4+5, 6+7 (specific poll_index combinations)

---

## **🔧 CORRECTED TEST FILES**

### **✅ WORKING TESTS (Use These):**

#### **1. `k6-single-choice-basic.js`**
- **Purpose**: Test single-choice polls only
- **Pattern**: Uses `x-session-id` header for consistent user tracking
- **Matrix Graphs**: ✅ **Tests Q1+Q2 pairing**
- **Usage**: `k6 run k6-single-choice-basic.js`

#### **2. `k6-ranking-basic.js`**
- **Purpose**: Test ranking polls only
- **Pattern**: No `x-session-id` header (API generates unique user ID)
- **Matrix Graphs**: ❌ **Cannot be paired**
- **Usage**: `k6 run k6-ranking-basic.js`

#### **3. `k6-wordcloud-basic.js`**
- **Purpose**: Test wordcloud polls only
- **Pattern**: No `x-session-id` header (API generates unique user ID)
- **Matrix Graphs**: ❌ **Cannot be paired**
- **Usage**: `k6 run k6-wordcloud-basic.js`

#### **4. `k6-matrix-graphs-comprehensive.js`**
- **Purpose**: Test all 4 matrix graph question pairs
- **Pattern**: Uses `x-session-id` header for consistent user tracking
- **Matrix Graphs**: ✅ **Tests all pairs: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8**
- **Usage**: `k6 run k6-matrix-graphs-comprehensive.js`

#### **5. `k6-polling-systems-demo.js`**
- **Purpose**: Demonstrate all polling systems with correct patterns
- **Pattern**: Shows correct approach for each poll type
- **Matrix Graphs**: ✅ **Demonstrates pairing requirements**
- **Usage**: `k6 run k6-polling-systems-demo.js`

#### **6. `k6-comprehensive-validation.js`**
- **Purpose**: Comprehensive validation of all polling systems
- **Pattern**: Tests all poll types with correct patterns
- **Matrix Graphs**: ✅ **Validates all matrix graph pairs**
- **Usage**: `k6 run k6-comprehensive-validation.js`

### **❌ BROKEN TESTS (Avoid These):**
- `k6-comprehensive-test-enhanced.js` - Mixed patterns, inconsistent user IDs
- `k6-matrix-graph-test-enhanced.js` - Missing `x-session-id` header
- `k6-ranking-test.js` - Unknown status, likely broken
- `k6-wordcloud-test.js` - Unknown status, likely broken
- `k6-survey-results-authenticated.js` - Unknown status, likely broken
- `k6-test.js` - Basic test, likely outdated

---

## **🎯 TESTING PATTERNS**

### **For Single-Choice Polls (Matrix Graph Compatible):**
```javascript
const payload = {
  pagePath: '/cew-polls/prioritization',
  pollIndex: 0,
  question: 'Test question',
  options: ['Option A', 'Option B', 'Option C'],
  optionIndex: 0,
  authCode: 'CEW2025'
};

const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
  headers: {
    'Content-Type': 'application/json',
    'x-session-id': sessionId  // CRITICAL: Same session ID for matrix graphs
  },
});
```

### **For Ranking Polls (Not Matrix Graph Compatible):**
```javascript
const payload = {
  pagePath: '/cew-polls/prioritization',
  pollIndex: 2,
  question: 'Test question',
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  rankings: [1, 2, 3, 4],
  authCode: 'CEW2025'
};

const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), {
  headers: {
    'Content-Type': 'application/json'
    // NOTE: No x-session-id header - API generates unique user ID
  },
});
```

### **For Wordcloud Polls (Not Matrix Graph Compatible):**
```javascript
const payload = {
  pagePath: '/cew-polls/prioritization',
  pollIndex: 4,
  question: 'Test question',
  maxWords: 1,
  wordLimit: 20,
  words: ['word1', 'word2'],
  authCode: 'CEW2025'
};

const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), {
  headers: {
    'Content-Type': 'application/json'
    // NOTE: No x-session-id header - API generates unique user ID
  },
});
```

---

## **🚀 QUICK START GUIDE**

### **1. Test Individual Poll Types:**
```bash
# Test single-choice polls (matrix graph compatible)
k6 run k6-single-choice-basic.js

# Test ranking polls (not matrix graph compatible)
k6 run k6-ranking-basic.js

# Test wordcloud polls (not matrix graph compatible)
k6 run k6-wordcloud-basic.js
```

### **2. Test Matrix Graph Pairing:**
```bash
# Test all 4 matrix graph pairs
k6 run k6-matrix-graphs-comprehensive.js
```

### **3. Demonstrate All Systems:**
```bash
# Show correct patterns for all poll types
k6 run k6-polling-systems-demo.js
```

### **4. Comprehensive Validation:**
```bash
# Validate all polling systems work correctly
k6 run k6-comprehensive-validation.js
```

---

## **📊 SUCCESS CRITERIA**

### **Single-Choice Polls:**
- ✅ Status 200 for all submissions
- ✅ Response time < 2 seconds
- ✅ Same user ID for both questions in pair
- ✅ Matrix graph API returns paired data

### **Ranking Polls:**
- ✅ Status 200 for all submissions
- ✅ Response time < 2 seconds
- ✅ Unique user ID per submission
- ✅ Results API returns data

### **Wordcloud Polls:**
- ✅ Status 200 for all submissions
- ✅ Response time < 2 seconds
- ✅ Unique user ID per submission
- ✅ Results API returns data

### **Matrix Graphs:**
- ✅ API returns status 200
- ✅ Response time < 2 seconds
- ✅ Data structure is valid
- ✅ Paired votes appear in correct quadrants

---

## **🔍 DEBUGGING TIPS**

### **If Matrix Graphs Show No Data:**
1. Check that both questions in pair were submitted with same `x-session-id`
2. Verify poll_index values are correct (0+1, 2+3, 4+5, 6+7)
3. Ensure both votes were successful (status 200)

### **If Ranking/Wordcloud Polls Fail:**
1. Check that no `x-session-id` header is sent
2. Verify payload structure matches API expectations
3. Check wordcloud word limits and validation rules

### **If Single-Choice Polls Fail:**
1. Check that `x-session-id` header is sent
2. Verify payload structure matches API expectations
3. Check that authCode is provided

---

## **📋 TESTING CHECKLIST**

### **Before Running Tests:**
- [ ] Verify BASE_URL is correct
- [ ] Check that database is accessible
- [ ] Ensure no conflicting test data exists
- [ ] Verify poll_index values match database

### **After Running Tests:**
- [ ] Check all status codes are 200
- [ ] Verify response times are acceptable
- [ ] Confirm matrix graph data appears correctly
- [ ] Validate results in admin panel

### **For Matrix Graph Testing:**
- [ ] Use same `x-session-id` for both questions in pair
- [ ] Test all 4 pairs: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8
- [ ] Verify data appears in correct quadrants
- [ ] Check that vote counts match expected values

---

## **🎯 KEY TAKEAWAYS**

1. **Single-choice polls** are the only type that can be paired for matrix graphs
2. **Ranking and wordcloud polls** generate unique user IDs per submission
3. **Matrix graphs** require the same `x-session-id` for both questions in a pair
4. **User ID generation** is different for each poll type
5. **Testing patterns** must match the actual API behavior

---

**This corrected approach ensures all polling systems work correctly and can be reliably tested.**
