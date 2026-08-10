-- Create student insight view for aggregated analytics
CREATE OR REPLACE VIEW student_insight_view AS
SELECT 
    s.id,
    s.first_name,
    s.last_name,
    s.age,
    s.gender,
    s.address,
    s.enrolled_year,
    p.code AS program_code,
    p.name AS program_name,
    d.code AS department_code,
    d.name AS department_name,
    1 AS total
FROM students s
LEFT JOIN programs p ON s.program_id = p.id
LEFT JOIN departments d ON p.department_id = d.id;

-- Create indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_students_program_id ON students(program_id);
CREATE INDEX IF NOT EXISTS idx_students_enrolled_year ON students(enrolled_year);
CREATE INDEX IF NOT EXISTS idx_students_gender ON students(gender);
CREATE INDEX IF NOT EXISTS idx_programs_department_id ON programs(department_id);
