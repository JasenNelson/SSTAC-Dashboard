// Simple Node.js script to test matrix pairing
// Run with: node debug-matrix-pairing.js

const BASE_URL = 'http://localhost:3000';

async function testMatrixPairing() {
  console.log('🔍 Testing Matrix Pairing Debug Endpoint...\n');
  
  try {
    // Test the debug endpoint
    const response = await fetch(`${BASE_URL}/api/debug/matrix-pairing?filter=all`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Debug Endpoint Working');
      console.log('📊 Summary:');
      console.log(`   Total Votes: ${data.summary.total_votes}`);
      console.log(`   Unique Users: ${data.summary.unique_users}`);
      console.log(`   CEW Users: ${data.summary.cew_users}`);
      console.log(`   Authenticated Users: ${data.summary.authenticated_users}`);
      console.log(`   Users with Pairs: ${data.summary.users_with_pairs}`);
      
      console.log('\n👥 Sample Users:');
      data.summary.sample_users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.user_id} (${user.user_type})`);
        console.log(`      Can Pair: ${user.can_pair}`);
        console.log(`      Vote Count: ${user.vote_count}`);
        console.log(`      Votes: ${user.votes.join(', ')}`);
      });
      
      // Test matrix API
      console.log('\n🔍 Testing Matrix API...');
      const matrixResponse = await fetch(`${BASE_URL}/api/graphs/prioritization-matrix?filter=all`);
      const matrixData = await matrixResponse.json();
      
      if (matrixData.success) {
        console.log('✅ Matrix API Working');
        console.log(`📊 Matrix Data Points: ${matrixData.data?.length || 0}`);
        
        if (matrixData.data && matrixData.data.length > 0) {
          const holisticData = matrixData.data.find(d => d.title.includes('Matrix Standards'));
          if (holisticData) {
            console.log(`   Holistic Protection Pairs: ${holisticData.individualPairs?.length || 0}`);
            if (holisticData.individualPairs && holisticData.individualPairs.length > 0) {
              console.log('   Sample Pairs:');
              holisticData.individualPairs.slice(0, 3).forEach((pair, index) => {
                console.log(`     ${index + 1}. User: ${pair.userId.substring(0, 20)}...`);
                console.log(`        Importance: ${pair.importance}, Feasibility: ${pair.feasibility}`);
                console.log(`        Type: ${pair.userType}`);
              });
            }
          }
        }
      } else {
        console.log('❌ Matrix API Error:', matrixData.error);
      }
      
    } else {
      console.log('❌ Debug Endpoint Error:', data.error);
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

// Run the test
testMatrixPairing();
