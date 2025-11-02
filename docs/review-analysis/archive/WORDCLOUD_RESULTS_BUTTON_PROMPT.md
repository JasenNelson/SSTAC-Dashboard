# Implementation Prompt: Wordcloud Results Button Feature

**Copy this entire prompt into a fresh AI chat to implement the wordcloud results button feature**

---

```
I need to implement a feature to hide wordcloud results by default and show them via a button only after the user submits their response.

## Context

I'm working on the SSTAC Dashboard project. On the `/survey-results/prioritization` page, Question 5 is a wordcloud poll where users submit a single word. Currently, the wordcloud results display automatically, but I want to change this behavior.

## Requirements

1. **Hide Results by Default**: Wordcloud results should NOT display automatically, even after user submits
2. **"View Results" Button**: After user submits their word, a button should appear to view aggregated results
3. **Aggregated Results**: The button should show ALL users' submissions (aggregated word frequencies), matching what the admin panel shows at `/admin/poll-results` for the same question
4. **Button Visibility**: Button should only appear AFTER user has submitted their word
5. **Scope**: This change should ONLY apply to `/survey-results/*` pages, NOT `/cew-polls/*` pages

## Current Behavior

- `WordCloudPoll` component automatically shows results after submission
- Results include both user's words and aggregated data
- Results display immediately after successful vote submission

## Desired Behavior

- Results hidden by default
- User submits word → sees confirmation message ("You submitted: X")
- "View Results" button appears below confirmation
- User clicks button → aggregated wordcloud displays (all users' words with frequencies)
- Aggregated results should match admin panel data exactly

## Technical Details

**Component to Modify:**
- `src/components/dashboard/WordCloudPoll.tsx`

**API Endpoint (already exists):**
- `GET /api/wordcloud-polls/results?pagePath=...&pollIndex=...`
- Returns: `{ results: { total_votes: number, words: Array<{text: string, value: number}>, user_words: string[] } }`
- The `words` array contains aggregated word frequencies from ALL users (this is what we need to display)

**Key Points:**
- The API already returns aggregated results in `results.words` array
- Each word has `{text: string, value: number}` where `value` is frequency count
- User's own submission is in `results.user_words` array (for confirmation display)
- No database or API changes needed - just component logic

## Implementation Tasks

1. **Add State Variables:**
   - `showAggregatedResults` (boolean) - controls visibility of aggregated results
   - `aggregatedWords` (array) - stores aggregated word data from API

2. **Modify Submission Handler:**
   - After successful submission, set `hasVoted = true` but keep `showResults = false`
   - Do NOT automatically fetch or display results
   - Continue showing user's submission confirmation

3. **Add "View Results" Button:**
   - Button appears when `hasVoted === true` AND `showAggregatedResults === false`
   - Button text: "View All Responses" or "View Results"
   - Position: Below user's submission confirmation message
   - Style: Match existing poll button styles (blue, rounded, etc.)

4. **Create Results Fetch Handler:**
   - Function `handleViewResults()` that fetches from `/api/wordcloud-polls/results`
   - Extract `results.words` array (aggregated data)
   - Update `aggregatedWords` state
   - Set `showAggregatedResults = true`

5. **Update Results Display:**
   - Show aggregated wordcloud only when `showAggregatedResults === true`
   - Use `aggregatedWords` for `CustomWordCloud` component
   - Display total response count

6. **Ensure CEW Pages Unchanged:**
   - Check if `pagePath.startsWith('/cew-polls/')` and skip this feature for CEW pages
   - CEW pages should maintain current behavior (privacy-focused, no results)

## Testing Checklist

- [x] Results hidden by default (before submission)
- [x] "View Results" button appears after submission
- [x] Button click shows aggregated results (all users' words)
- [x] Aggregated results match admin panel data
- [x] Word frequencies are correct
- [x] CEW pages remain unchanged
- [x] User's submission confirmation still displays
- [x] No console errors

## Implementation Status: ✅ COMPLETE

**Completed:** January 2025

### Changes Made:

1. **WordCloudPoll Component** (`src/components/dashboard/WordCloudPoll.tsx`):
   - Added `showAggregatedResults` state to control visibility
   - Added `isFetchingAggregated` state for loading indicator
   - Created `handleViewResults()` function to fetch aggregated results
   - Modified submission handler to NOT auto-show results
   - Added "View All Responses" button that appears after submission
   - Updated results display to only show when button clicked
   - CEW pages remain unchanged (no button, privacy maintained)

2. **API Endpoint** (`src/app/api/wordcloud-polls/results/route.ts`):
   - Changed from broken `get_wordcloud_word_counts` function to `wordcloud_results` view
   - Enhanced to combine data from both `/survey-results` and `/cew-polls` paths
   - Aggregates word frequencies by summing across both paths
   - Calculates total responses by summing distinct user counts from both paths
   - Returns combined results matching admin panel data

### Important Notes

- **No Database Changes**: Used existing `wordcloud_results` view (same as admin panel)
- **API Enhanced**: Now combines survey-results and cew-polls data for complete results
- **Admin Panel**: No changes needed - already shows aggregated results correctly
- **Scope**: Only affects `/survey-results/*` pages, not CEW pages
- **Data Source**: Uses `results.words` from API response (aggregated), combines both paths

## Files to Review

1. `src/components/dashboard/WordCloudPoll.tsx` - Main component to modify
2. `src/app/api/wordcloud-polls/results/route.ts` - Verify API response format (no changes needed)
3. `src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx` - Verify usage (no changes needed)

Please implement these changes following the plan, ensuring that:
- The feature works correctly on prioritization page (Question 5)
- Aggregated results match admin panel exactly
- CEW pages are not affected
- Code follows existing patterns and styling
- All edge cases are handled gracefully
```

---

## How to Use This Prompt

1. **Copy the entire prompt** (everything between the ``` markers)
2. **Open a fresh AI chat window**
3. **Paste the prompt** and send it
4. **Review the implementation** before accepting changes
5. **Test thoroughly** on the prioritization page

---

## Expected Outcome

After implementation, the wordcloud poll on `/survey-results/prioritization` (Question 5) will:
- Hide results by default
- Show "View All Responses" button after user submits
- Display aggregated wordcloud with all users' submissions when button is clicked
- Match the aggregated results shown in admin panel

---

**Ready for implementation!** 🚀

