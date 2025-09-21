-- Create Vote Backup Function
-- Run this in your Supabase SQL Editor to create the backup function

CREATE OR REPLACE FUNCTION create_vote_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create backup tables if they don't exist
  CREATE TABLE IF NOT EXISTS poll_votes_backup (
    LIKE poll_votes INCLUDING ALL,
    backup_created_at TIMESTAMP DEFAULT NOW()
  );
  
  CREATE TABLE IF NOT EXISTS ranking_votes_backup (
    LIKE ranking_votes INCLUDING ALL,
    backup_created_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Insert current data into backup tables
  INSERT INTO poll_votes_backup 
  SELECT *, NOW() FROM poll_votes;
  
  INSERT INTO ranking_votes_backup 
  SELECT *, NOW() FROM ranking_votes;
  
  RETURN 'Backup created successfully at ' || NOW();
END;
$$;
