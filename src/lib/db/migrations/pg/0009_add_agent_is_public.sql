-- Add is_public column to agent table
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
