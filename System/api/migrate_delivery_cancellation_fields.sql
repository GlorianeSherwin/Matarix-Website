-- Migration: Add Cancellation and Reschedule Fields to Deliveries Table
-- Run this SQL script to add fields for tracking delivery cancellations and reschedules

-- Add cancellation tracking fields
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) DEFAULT NULL COMMENT 'Reason for cancellation',
ADD COLUMN IF NOT EXISTS cancelled_by INT(11) DEFAULT NULL COMMENT 'User_ID of employee/admin who cancelled',
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when delivery was cancelled',
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL COMMENT 'Internal notes for staff (not visible to customer)',
ADD COLUMN IF NOT EXISTS reschedule_count INT(11) DEFAULT 0 COMMENT 'Number of times this delivery has been rescheduled',
ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of last reschedule';

-- Add foreign key for cancelled_by
ALTER TABLE deliveries 
ADD CONSTRAINT fk_deliveries_cancelled_by 
FOREIGN KEY (cancelled_by) REFERENCES users(User_ID) ON DELETE SET NULL;

-- Add index for faster queries on cancelled deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_cancelled ON deliveries(cancelled_at, Delivery_Status);
CREATE INDEX IF NOT EXISTS idx_deliveries_reschedule ON deliveries(reschedule_count, last_rescheduled_at);
