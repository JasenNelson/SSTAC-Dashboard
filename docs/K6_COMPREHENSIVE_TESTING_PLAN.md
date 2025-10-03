# 🧪 Comprehensive K6 Testing Plan - SSTAC & TWG Dashboard Polling System

## 🎯 **Testing Objectives**

Create a comprehensive K6 test suite to validate all aspects of the polling system across:
- **CEW Poll Pages** (`/cew-polls/*`) - Unauthenticated conference polling
- **Survey Results Pages** (`/survey-results/*`) - Authenticated user polling  
- **Admin Poll Results** (`/admin/poll-results`) - Administrative interface
- **Matrix Graph System** - Vote pairing and visualization
- **API Endpoints** - All poll submission and retrieval APIs

## 📊 **System Overview for Testing**

### **Three Poll Systems**
1. **Single-Choice Polls** (`polls` + `poll_votes` tables)
2. **Ranking Polls** (`ranking_polls` + `ranking_votes` tables)  
3. **Wordcloud Polls** (`wordcloud_polls` + `wordcloud_votes` tables)

### **Four Page Types**
1. **CEW Poll Pages** - Conference attendees (CEW2025 code)
2. **Survey Results Pages** - Authenticated users (password required)
3. **Admin Poll Results** - Administrative interface
4. **Matrix Graph API** - Data visualization endpoints

### **User Types**
- **CEW Users**: Multiple votes allowed, unique user_id generation
- **Authenticated Users**: Single vote per question (upsert behavior)
- **Admin Users**: Full system access and management

## 🎯 **Test Categories**

### **Category 1: CEW Poll System Testing**
**Objective**: Validate unauthenticated conference polling functionality

#### **Test 1.1: CEW Single-Choice Polls**
- **Pages**: `/cew-polls/holistic-protection`, `/cew-polls/prioritization`, `/cew-polls/tiered-framework`
- **Questions**: All single-choice questions (Q1, Q3, Q5, Q7 in holistic; Q1-Q2 in prioritization; Q1-Q3 in tiered)
- **Test Scenarios**:
  - Single vote submission per question
  - Multiple vote submissions (page refresh simulation)
  - User ID consistency across votes
  - Vote persistence and retrieval
  - Error handling for invalid submissions

#### **Test 1.2: CEW Ranking Polls**
- **Pages**: Same as above
- **Questions**: All ranking questions (Q2, Q4, Q6, Q8 in holistic; Q3-Q4 in prioritization; none in tiered)
- **Test Scenarios**:
  - Complete ranking submission (all options ranked)
  - Partial ranking submission
  - Multiple ranking submissions
  - Ranking validation and error handling

#### **Test 1.3: CEW Wordcloud Polls**
- **Pages**: `/cew-polls/prioritization` (Question 5)
- **Questions**: Wordcloud questions with predefined options
- **Test Scenarios**:
  - Single word submission (Question 5)
  - Multiple word submissions (other wordcloud polls)
  - Predefined option selection
  - Custom word input
  - Character limit validation

### **Category 2: Authenticated User Testing**
**Objective**: Validate authenticated user polling functionality

#### **Test 2.1: Survey Results Single-Choice Polls**
- **Pages**: `/survey-results/holistic-protection`, `/survey-results/prioritization`, `/survey-results/tiered-framework`
- **Authentication**: Simulate authenticated user sessions
- **Test Scenarios**:
  - Single vote submission per question
  - Vote change functionality (upsert behavior)
  - Authentication validation
  - Session persistence

#### **Test 2.2: Survey Results Ranking Polls**
- **Pages**: Same as above
- **Test Scenarios**:
  - Complete ranking submission
  - Ranking change functionality
  - Authentication validation

#### **Test 2.3: Survey Results Wordcloud Polls**
- **Pages**: `/survey-results/prioritization` (Question 5)
- **Test Scenarios**:
  - Word submission with authentication
  - Word change functionality
  - Authentication validation

### **Category 3: Matrix Graph System Testing**
**Objective**: Validate vote pairing and matrix graph functionality

#### **Test 3.1: Matrix Graph Data Generation**
- **API Endpoint**: `/api/graphs/prioritization-matrix`
- **Test Scenarios**:
  - CEW vote pairing validation
  - Authenticated vote pairing validation
  - Mixed user type data combination
  - Filter system validation (all, cew, twg)
  - Chronological pairing verification

#### **Test 3.2: Matrix Graph Question Pairs**
- **Holistic Protection**: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8
- **Prioritization**: Q1+Q2
- **Test Scenarios**:
  - Individual question pair testing
  - Multiple question pair testing
  - Data point count validation
  - Coordinate calculation verification

### **Category 4: Admin Interface Testing**
**Objective**: Validate administrative poll results interface

#### **Test 4.1: Admin Poll Results Display**
- **Page**: `/admin/poll-results`
- **Test Scenarios**:
  - Poll results loading and display
  - Filter functionality (all, twg, cew)
  - Question navigation
  - Vote count accuracy
  - Real-time updates

#### **Test 4.2: Admin Matrix Graph Display**
- **Component**: Matrix graph components in admin panel
- **Test Scenarios**:
  - Matrix graph rendering
  - Data point visualization
  - Filter mode switching
  - Overlapping data point handling

### **Category 5: API Endpoint Testing**
**Objective**: Validate all API endpoints functionality

#### **Test 5.1: Poll Submission APIs**
- **Endpoints**: 
  - `POST /api/polls/submit`
  - `POST /api/ranking-polls/submit`
  - `POST /api/wordcloud-polls/submit`
- **Test Scenarios**:
  - Valid submission handling
  - Invalid submission error handling
  - User ID generation validation
  - Database insertion verification

#### **Test 5.2: Poll Results APIs**
- **Endpoints**:
  - `GET /api/polls/results`
  - `GET /api/ranking-polls/results`
  - `GET /api/wordcloud-polls/results`
- **Test Scenarios**:
  - Results retrieval accuracy
  - Data aggregation validation
  - Error handling for missing data

#### **Test 5.3: Matrix Graph API**
- **Endpoint**: `GET /api/graphs/prioritization-matrix`
- **Test Scenarios**:
  - Data pairing accuracy
  - Filter parameter handling
  - Response format validation
  - Performance under load

## 🚀 **K6 Test Implementation Plan**

### **Phase 1: Core Infrastructure Tests**
1. **Basic Connectivity Tests**
   - Server availability
   - API endpoint accessibility
   - Database connectivity

2. **Authentication Tests**
   - CEW code validation
   - Authenticated user simulation
   - Session management

### **Phase 2: Poll System Tests**
1. **Single-Choice Poll Tests**
   - CEW single-choice polling
   - Authenticated single-choice polling
   - Vote persistence and retrieval

2. **Ranking Poll Tests**
   - CEW ranking polling
   - Authenticated ranking polling
   - Ranking validation

3. **Wordcloud Poll Tests**
   - CEW wordcloud polling
   - Authenticated wordcloud polling
   - Word validation and limits

### **Phase 3: Matrix Graph Tests**
1. **Vote Pairing Tests**
   - CEW vote pairing validation
   - Authenticated vote pairing validation
   - Mixed user type pairing

2. **Matrix Graph API Tests**
   - Data retrieval accuracy
   - Filter system validation
   - Response format validation

### **Phase 4: Admin Interface Tests**
1. **Admin Poll Results Tests**
   - Results display accuracy
   - Filter functionality
   - Real-time updates

2. **Admin Matrix Graph Tests**
   - Matrix graph rendering
   - Data visualization accuracy

### **Phase 5: Performance and Load Tests**
1. **Concurrent User Tests**
   - Multiple CEW users
   - Multiple authenticated users
   - Mixed user type load

2. **Stress Tests**
   - High volume vote submissions
   - Database performance under load
   - API response time validation

## 📋 **Test Data Requirements**

### **CEW Test Data**
- **Conference Code**: CEW2025
- **User Sessions**: Simulate multiple conference attendees
- **Vote Patterns**: Realistic voting distributions
- **Session Management**: Page refresh simulation

### **Authenticated Test Data**
- **User Accounts**: Simulate authenticated users
- **Vote Patterns**: Single vote per question with changes
- **Session Management**: Persistent authentication

### **Matrix Graph Test Data**
- **Question Pairs**: All defined question pairs
- **Vote Combinations**: Various importance/feasibility combinations
- **User Types**: Both CEW and authenticated users
- **Filter Scenarios**: All three filter modes

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ All poll types submit successfully
- ✅ Vote pairing works correctly for matrix graphs
- ✅ Filter system functions properly
- ✅ Admin interface displays accurate data
- ✅ API endpoints return correct responses

### **Performance Requirements**
- ✅ Response times < 500ms for poll submissions
- ✅ Response times < 1000ms for matrix graph API
- ✅ System handles 100+ concurrent users
- ✅ Database queries perform efficiently

### **Data Integrity Requirements**
- ✅ Vote counts are accurate
- ✅ User ID generation is consistent
- ✅ Matrix graph data points are correct
- ✅ Filter results match expected data

## 🔧 **Implementation Strategy**

### **Test Script Organization**
```
tests/
├── k6-core-infrastructure.js          # Basic connectivity and auth
├── k6-cew-single-choice.js            # CEW single-choice polls
├── k6-cew-ranking.js                  # CEW ranking polls
├── k6-cew-wordcloud.js                # CEW wordcloud polls
├── k6-authenticated-single-choice.js  # Authenticated single-choice polls
├── k6-authenticated-ranking.js        # Authenticated ranking polls
├── k6-authenticated-wordcloud.js      # Authenticated wordcloud polls
├── k6-matrix-graph-pairing.js         # Matrix graph vote pairing
├── k6-matrix-graph-api.js             # Matrix graph API testing
├── k6-admin-poll-results.js           # Admin poll results interface
├── k6-admin-matrix-graphs.js          # Admin matrix graph display
├── k6-api-endpoints.js                # All API endpoint testing
├── k6-performance-load.js             # Performance and load testing
└── k6-comprehensive-suite.js          # Complete test suite runner
```

### **Test Execution Strategy**
1. **Individual Test Execution**: Run each test category separately
2. **Integrated Test Execution**: Run complete test suite
3. **Performance Monitoring**: Track response times and resource usage
4. **Data Validation**: Verify database state after tests
5. **Error Analysis**: Comprehensive error reporting and analysis

## 📊 **Expected Test Results**

### **Functional Test Results**
- **Poll Submissions**: 100% success rate
- **Vote Pairing**: Accurate matrix graph data points
- **Filter System**: Correct data filtering
- **Admin Interface**: Accurate data display

### **Performance Test Results**
- **Response Times**: < 500ms average
- **Concurrent Users**: 100+ users supported
- **Database Performance**: Efficient query execution
- **Memory Usage**: Stable memory consumption

### **Data Integrity Results**
- **Vote Counts**: Accurate across all poll types
- **User ID Consistency**: Proper user identification
- **Matrix Graph Data**: Correct coordinate calculations
- **Filter Accuracy**: Proper data separation

## 🎯 **Next Steps**

1. **Create Individual Test Scripts**: Implement each test category
2. **Set Up Test Data**: Prepare realistic test data sets
3. **Configure Test Environment**: Set up K6 testing infrastructure
4. **Execute Test Suite**: Run comprehensive testing
5. **Analyze Results**: Review test results and identify issues
6. **Optimize Performance**: Address any performance bottlenecks
7. **Document Findings**: Create comprehensive test report

This comprehensive testing plan will ensure the polling system is robust, performant, and ready for production use in stakeholder engagement activities.
