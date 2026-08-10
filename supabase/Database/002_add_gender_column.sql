-- Add gender column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('Male', 'Female'));

-- Update existing records with a default gender (optional - you may want to set these manually)
-- For demonstration purposes, we'll set alternating genders
-- In production, you would want to update these values appropriately
