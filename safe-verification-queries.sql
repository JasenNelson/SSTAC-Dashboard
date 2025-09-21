-- SAFE VERIFICATION QUERIES - RUN THESE FIRST
-- These are READ-ONLY queries to understand the current state before making any changes

-- 1. Check ALL polls in the database to understand the full scope
SELECT 'ALL POLLS IN DATABASE' as info;
SELECT 
    id,
    page_path, 
    poll_index, 
    LEFT(question, 80) as question_start,
    created_at,
    updated_at
FROM polls 
ORDER BY page_path, poll_index;

-- 2. Check ALL ranking polls in the database
SELECT 'ALL RANKING POLLS IN DATABASE' as info;
SELECT 
    id,
    page_path, 
    poll_index, 
    LEFT(question, 80) as question_start,
    created_at,
    updated_at
FROM ranking_polls 
ORDER BY page_path, poll_index;

-- 3. Check vote counts for ALL polls to see what has real data
SELECT 'POLL VOTE COUNTS' as info;
SELECT 
    p.page_path,
    p.poll_index,
    pr.total_votes,
    COUNT(pv.id) as actual_votes,
    pr.total_votes = COUNT(pv.id) as vote_count_matches
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
GROUP BY p.id, p.page_path, p.poll_index, pr.total_votes
ORDER BY p.page_path, p.poll_index;

-- 4. Check ranking poll vote counts
SELECT 'RANKING POLL VOTE COUNTS' as info;
SELECT 
    rp.page_path,
    rp.poll_index,
    rr.total_votes,
    COUNT(rv.id) as actual_votes
FROM ranking_polls rp
LEFT JOIN ranking_results rr ON rp.id = rr.ranking_poll_id
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, rp.page_path, rp.poll_index, rr.total_votes
ORDER BY rp.page_path, rp.poll_index;

-- 5. Check what questions are actually on the CEW holistic protection page
SELECT 'CEW HOLISTIC PROTECTION POLLS' as info;
SELECT 
    p.id,
    p.poll_index,
    p.question,
    pr.total_votes,
    p.created_at
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
WHERE p.page_path = '/cew-polls/holistic-protection'
ORDER BY p.poll_index;

-- 6. Check what questions are actually on the survey holistic protection page
SELECT 'SURVEY HOLISTIC PROTECTION POLLS' as info;
SELECT 
    p.id,
    p.poll_index,
    p.question,
    pr.total_votes,
    p.created_at
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
WHERE p.page_path = '/survey-results/holistic-protection'
ORDER BY p.poll_index;

-- 7. Check if there are any polls with high vote counts that might be real data
SELECT 'POLLS WITH HIGH VOTE COUNTS' as info;
SELECT 
    p.page_path,
    p.poll_index,
    LEFT(p.question, 60) as question_start,
    pr.total_votes,
    p.created_at
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
WHERE pr.total_votes > 10
ORDER BY pr.total_votes DESC;

-- 8. Check all polls by page path to understand the scope
SELECT 'ALL POLLS BY PAGE PATH' as info;
SELECT 
    p.page_path,
    COUNT(*) as poll_count,
    MIN(p.poll_index) as min_index,
    MAX(p.poll_index) as max_index,
    SUM(pr.total_votes) as total_votes_all_polls
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
GROUP BY p.page_path
ORDER BY p.page_path;

-- 9. Check all ranking polls by page path
SELECT 'ALL RANKING POLLS BY PAGE PATH' as info;
SELECT 
    rp.page_path,
    COUNT(*) as ranking_poll_count,
    MIN(rp.poll_index) as min_index,
    MAX(rp.poll_index) as max_index,
    SUM(rr.total_votes) as total_votes_all_polls
FROM ranking_polls rp
LEFT JOIN ranking_results rr ON rp.id = rr.ranking_poll_id
GROUP BY rp.page_path
ORDER BY rp.page_path;

-- 10. Check for any polls with questions that don't match current page content
SELECT 'POTENTIALLY OUTDATED POLLS' as info;
SELECT 
    p.page_path,
    p.poll_index,
    LEFT(p.question, 100) as question_start,
    pr.total_votes,
    p.created_at
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
WHERE p.page_path IN (
    '/survey-results/holistic-protection',
    '/cew-polls/holistic-protection',
    '/survey-results/tiered-framework',
    '/cew-polls/tiered-framework',
    '/cew-polls/prioritization'
)
ORDER BY p.page_path, p.poll_index;
