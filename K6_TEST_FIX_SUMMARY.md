# K6 Test Fix Summary

## 🚨 Current Issues

The k6 tests are failing due to **Row Level Security (RLS) policy violations** on the `wordcloud_votes` table. The error message shows:

```
"new row violates row-level security policy for table \"wordcloud_votes\""
```

## 🔧 Root Cause

The RLS policies on the `wordcloud_votes` table are too restrictive and don't allow:
1. **CEW users** (using `authCode: 'CEW2025'`) to insert votes
2. **Survey-results users** (using `authCode: 'SURVEY2025'`) to insert votes

## 🛠️ Solution Required

### Step 1: Fix RLS Policies
Run the SQL script `fix_wordcloud_rls_policies.sql` in your Supabase SQL Editor:

```sql
-- This script updates the RLS policies to properly handle both authenticated and anonymous users
-- It allows CEW codes (CEW2025) and survey codes (SURVEY2025) to insert wordcloud votes
```

### Step 2: Test the Fix
After running the SQL script, test the fix with:

```bash
# Test the wordcloud API directly
node test-wordcloud-fix.js

# Run the corrected k6 tests
k6 run k6-wordcloud-focused-test.js
k6 run k6-authentication-test.js
```

## 📊 Expected Results After Fix

### Wordcloud Test
- **Success Rate**: > 98% (currently 48.72%)
- **Error Rate**: < 5% (currently 33.45%)
- **Status**: 200 OK for both CEW and survey-results pages

### Authentication Test
- **Survey-results pages**: 200 OK with `authCode: 'SURVEY2025'`
- **CEW pages**: 200 OK with `authCode: 'CEW2025'`
- **Overall Success Rate**: > 95%

## 🔍 What the Fix Does

The updated RLS policies allow:

1. **Authenticated users** to insert their own votes (using their UUID)
2. **CEW users** to insert votes using `user_id: 'CEW2025'`
3. **Survey-results users** to insert votes using `user_id: 'SURVEY2025'`
4. **Anonymous users** to view all votes (for public results)

## 📝 Files Modified

1. **`fix_wordcloud_rls_policies.sql`** - SQL script to fix RLS policies
2. **`test-wordcloud-fix.js`** - Simple test to verify the fix
3. **`k6-wordcloud-focused-test.js`** - Updated with correct authCode values
4. **`k6-authentication-test.js`** - Updated with correct authCode values

## 🚀 Next Steps

1. **Run the SQL script** in Supabase SQL Editor
2. **Test the fix** with the provided test script
3. **Run the k6 tests** to verify everything works
4. **Commit the changes** once tests pass

## 📈 Performance Expectations

After the fix, the k6 tests should show:
- **Wordcloud submissions**: 98%+ success rate
- **Response times**: < 1 second
- **Error rates**: < 5%
- **All poll types working**: Single-choice, ranking, wordcloud

The authentication fix ensures that both survey-results and cew-polls pages work correctly with their respective authentication methods.
