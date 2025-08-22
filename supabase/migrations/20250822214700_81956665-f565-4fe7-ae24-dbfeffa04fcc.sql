-- Remove o registro inválido com UUID zerado da tabela admin_setup
DELETE FROM admin_setup 
WHERE admin_user_id = '00000000-0000-0000-0000-000000000000';