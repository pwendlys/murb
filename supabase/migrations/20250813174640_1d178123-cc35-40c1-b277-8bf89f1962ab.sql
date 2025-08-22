-- Update admin_setup table to use the correct admin ID that matches the code
UPDATE admin_setup 
SET admin_user_id = '00000000-0000-0000-0000-000000000001' 
WHERE admin_user_id = '00000000-0000-0000-0000-000000000000';