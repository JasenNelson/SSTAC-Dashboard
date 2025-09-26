// Simple test to verify wordcloud API works after RLS fix
const https = require('https');

const BASE_URL = 'https://sstac-dashboard.vercel.app';

async function testWordcloudSubmission(pagePath, pollIndex, words, authCode) {
  const url = `${BASE_URL}/api/wordcloud-polls/submit`;
  
  const payload = {
    pagePath,
    pollIndex,
    question: 'Test wordcloud question for RLS fix',
    maxWords: 3,
    wordLimit: 20,
    words,
    authCode
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'sstac-dashboard.vercel.app',
      port: 443,
      path: '/api/wordcloud-polls/submit',
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
          body: body,
          pagePath,
          authCode
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

async function runTests() {
  console.log('Testing Wordcloud RLS Fix');
  console.log('==========================');
  
  const testCases = [
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 12,
      words: ['test', 'word', 'cloud'],
      authCode: 'CEW2025',
      expectedStatus: 200
    },
    {
      pagePath: '/survey-results/prioritization',
      pollIndex: 12,
      words: ['test', 'word', 'cloud'],
      authCode: 'SURVEY2025',
      expectedStatus: 200
    }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.pagePath} with authCode: ${testCase.authCode}`);
    
    try {
      const result = await testWordcloudSubmission(
        testCase.pagePath,
        testCase.pollIndex,
        testCase.words,
        testCase.authCode
      );
      
      console.log(`  Status: ${result.status}`);
      console.log(`  Expected: ${testCase.expectedStatus}`);
      
      if (result.status === testCase.expectedStatus) {
        console.log(`  ✅ PASS - Status matches expected`);
        passed++;
      } else {
        console.log(`  ❌ FAIL - Status does not match expected`);
        console.log(`  Response body: ${result.body}`);
      }
    } catch (error) {
      console.log(`  ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! RLS fix is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the RLS policies.');
  }
}

runTests().catch(console.error);
