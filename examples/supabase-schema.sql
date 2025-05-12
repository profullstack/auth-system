-- Supabase SQL Schema for Auth System
-- Run this in the Supabase SQL Editor to create the necessary tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  profile JSONB DEFAULT '{}'::jsonb,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Invalidated tokens table
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  invalidated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_token ON invalidated_tokens (token);

-- Row Level Security (RLS) policies
-- These policies restrict access to the tables

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on invalidated_tokens table
ALTER TABLE invalidated_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy for users table (only service role can access)
CREATE POLICY users_service_role_policy ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE is_service_role = true));

-- Create policy for invalidated_tokens table (only service role can access)
CREATE POLICY invalidated_tokens_service_role_policy ON invalidated_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE is_service_role = true));

-- Optional: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at when a user is updated
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Optional: Add a function to clean up expired invalidated tokens
-- This can be run periodically to remove old tokens
CREATE OR REPLACE FUNCTION cleanup_invalidated_tokens(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM invalidated_tokens
  WHERE invalidated_at < NOW() - (days_to_keep * INTERVAL '1 day')
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT cleanup_invalidated_tokens(30); -- Clean up tokens older than 30 days