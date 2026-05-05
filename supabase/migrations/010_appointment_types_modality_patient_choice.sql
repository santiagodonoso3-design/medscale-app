-- Allow 'patient_choice' as a valid modality value in appointment_types.
-- The column is TEXT so no type change is needed — just drop any existing CHECK constraint.
ALTER TABLE appointment_types
  DROP CONSTRAINT IF EXISTS appointment_types_modality_check;
