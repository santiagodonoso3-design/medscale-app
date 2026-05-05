ALTER TABLE appointment_types
  ADD COLUMN languages TEXT[] DEFAULT ARRAY['es'];
