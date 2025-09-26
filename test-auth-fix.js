// Quick test to verify authentication fix for wordcloud polls
// This is a simple Node.js script to test the API endpoints

const https = require('https');

const BASE_URL = 'https://sstac-dashboard.vercel.app';

// Test data
const testCases = [
  {
    name: 'Survey Results - Should require authentication (401 expected)',
    pagePath: '/survey-results/prioritization',
    pollIndex: 12,
    authCode: null,
    expectStatus: 401
  },
  {
    name: 'CEW Polls - Should work with authCode (200 expected)',
    pagePath: '/cew-polls/prioritization',
    pollIndex: 12,
    authCode: 'CEW2025',
    expectStatus: 200
  }
];

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'sstac-dashboard.vercel.app',
      port: 443,
      path: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function testWordcloudSubmission(testCase) {
  console.log(`\nTesting: ${testCase.name}`);
  
  const payload = {
    pagePath: testCase.pagePath,
    pollIndex: testCase.pollIndex,
    question: 'Test wordcloud question for authentication',
    maxWords: 3,
    wordLimit: 20,
    words: ['test', 'word', 'cloud'],
    authCode: testCase.authCode
  };

  try {
    const response = await makeRequest('/api/wordcloud-polls/submit', payload);
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Expected: ${testCase.expectStatus}`);
    
    if (response.status === testCase.expectStatus) {
      console.log(`  ✅ PASS - Status matches expected`);
    } else {
      console.log(`  ❌ FAIL - Status does not match expected`);
      console.log(`  Response body: ${response.body}`);
    }
    
    return response.status === testCase.expectStatus;
  } catch (error) {
    console.log(`  ❌ ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Wordcloud Authentication Fix');
  console.log('=====================================');
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    const result = await testWordcloudSubmission(testCase);
    if (result) passed++;
  }
  
  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Authentication fix is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the authentication implementation.');
  }
}

runTests().catch(console.error);
