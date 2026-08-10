-- Add latitude and longitude columns to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_students_location ON students(latitude, longitude);

-- Add comment to columns
COMMENT ON COLUMN students.latitude IS 'Latitude coordinate of student address';
COMMENT ON COLUMN students.longitude IS 'Longitude coordinate of student address';
