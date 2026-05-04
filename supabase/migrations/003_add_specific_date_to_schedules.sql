-- Add specific_date column to schedules for date-specific exceptions
-- Recurring schedules use day_of_week; exceptions use specific_date + is_recurring=false
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS specific_date DATE;
