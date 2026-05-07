ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS doctor_assignment_type TEXT
CHECK (doctor_assignment_type IN ('patient_choice', 'auto_assigned'))
DEFAULT 'auto_assigned';
