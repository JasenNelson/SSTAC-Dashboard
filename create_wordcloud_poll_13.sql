-- Create wordcloud poll for question 13 (Prioritization)
-- This is the wordcloud question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?"

-- Insert for survey-results page
INSERT INTO wordcloud_polls (id, page_path, poll_index, question, max_words, word_limit, predefined_options) VALUES
(
  uuid_generate_v4(),
  '/survey-results/prioritization',
  12,
  'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?',
  3,
  20,
  '[
    {"display": "Data availability", "keyword": "Data"},
    {"display": "Tools (models, test protocols, decision trees)", "keyword": "Tools"},
    {"display": "Agreement on protection goals and spatial scale", "keyword": "Policy"},
    {"display": "Resourcing (e.g., developing approach/tools, agreeing across peers)", "keyword": "Resources"},
    {"display": "Other", "keyword": "Other"}
  ]'::jsonb
);

-- Insert for cew-polls page
INSERT INTO wordcloud_polls (id, page_path, poll_index, question, max_words, word_limit, predefined_options) VALUES
(
  uuid_generate_v4(),
  '/cew-polls/prioritization',
  12,
  'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?',
  3,
  20,
  '[
    {"display": "Data availability", "keyword": "Data"},
    {"display": "Tools (models, test protocols, decision trees)", "keyword": "Tools"},
    {"display": "Agreement on protection goals and spatial scale", "keyword": "Policy"},
    {"display": "Resourcing (e.g., developing approach/tools, agreeing across peers)", "keyword": "Resources"},
    {"display": "Other", "keyword": "Other"}
  ]'::jsonb
);

-- Verify the polls were created
SELECT page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;
