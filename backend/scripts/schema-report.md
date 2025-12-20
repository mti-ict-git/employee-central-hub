# Database Schema Report
Database: MTIMasterEmployeeDB

## dbo.audit_trail
- Columns:
  - audit_id: bigint, precision=19
  - table_name: nvarchar, len=128
  - record_id: nvarchar, len=50
  - operation_type: nvarchar, len=10
  - old_values: nvarchar (nullable), len=-1
  - new_values: nvarchar (nullable), len=-1
  - changed_fields: nvarchar (nullable), len=-1
  - user_id: nvarchar (nullable), len=50
  - user_role: nvarchar (nullable), len=50
  - ip_address: nvarchar (nullable), len=45
  - user_agent: nvarchar (nullable), len=500
  - session_id: nvarchar (nullable), len=128
  - timestamp: datetime2
  - reason: nvarchar (nullable), len=500
- Primary Key: audit_id

## dbo.column_catalog
- Columns:
  - id: int, precision=10
  - table_name: nvarchar, len=128
  - column_name: nvarchar, len=128
  - display_label: nvarchar (nullable), len=128
  - data_type: nvarchar (nullable), len=64
  - is_exportable: bit
  - is_sensitive: bit
  - is_active: bit
  - created_at: datetime2
  - updated_at: datetime2
- Primary Key: id

## dbo.dashboard_widgets
- Columns:
  - widget_id: int, precision=10
  - user_id: int, precision=10
  - widget_type: nvarchar, len=50
  - widget_name: nvarchar, len=100
  - position_x: int, precision=10
  - position_y: int, precision=10
  - width: int, precision=10
  - height: int, precision=10
  - config: nvarchar (nullable), len=-1
  - data_source: nvarchar (nullable), len=100
  - refresh_interval: int (nullable), precision=10
  - is_visible: bit
  - created_at: datetime2
  - updated_at: datetime2 (nullable)
- Primary Key: widget_id

## dbo.employee_bank
- Columns:
  - employee_id: varchar, len=20
  - bank_name: varchar (nullable), len=50
  - account_name: varchar (nullable), len=100
  - account_no: varchar (nullable), len=100
  - bank_code: nvarchar (nullable), len=255
  - icbc_bank_account_no: nvarchar (nullable), len=255
  - icbc_username: nvarchar (nullable), len=255
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_bank_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_bank_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.employee_checklist
- Columns:
  - checklist_id: int, precision=10
  - employee_id: varchar, len=255
  - paspor_checklist: bit (nullable)
  - kitas_checklist: bit (nullable)
  - imta_checklist: bit (nullable)
  - rptka_checklist: bit (nullable)
  - npwp_checklist: bit (nullable)
  - bpjs_kes_checklist: bit (nullable)
  - bpjs_tk_checklist: bit (nullable)
  - bank_checklist: bit (nullable)
  - created_at: datetime2
  - updated_at: datetime2
- Primary Key: checklist_id

## dbo.employee_contact
- Columns:
  - employee_id: varchar, len=20
  - phone_number: varchar (nullable), len=20
  - email: varchar (nullable), len=100
  - address: varchar (nullable), len=200
  - city: varchar (nullable), len=50
  - emergency_contact_name: varchar (nullable), len=100
  - emergency_contact_phone: varchar (nullable), len=20
  - spouse_name: varchar (nullable), len=100
  - child_name_1: varchar (nullable), len=100
  - child_name_2: varchar (nullable), len=100
  - child_name_3: varchar (nullable), len=100
  - created_at: datetime2
  - created_by: nvarchar (nullable), len=50
  - updated_at: datetime2 (nullable)
  - updated_by: nvarchar (nullable), len=50
  - version_number: int, precision=10
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_contact_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_contact_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.employee_core
- Columns:
  - employee_id: varchar, len=20
  - imip_id: varchar (nullable), len=20
  - name: varchar (nullable), len=100
  - gender: char (nullable), len=1
  - place_of_birth: varchar (nullable), len=50
  - date_of_birth: date (nullable)
  - nationality: varchar (nullable), len=20
  - blood_type: varchar (nullable), len=3
  - marital_status: varchar (nullable), len=20
  - tax_status: varchar (nullable), len=5
  - religion: varchar (nullable), len=50
  - education: varchar (nullable), len=50
  - age: int (nullable), precision=10
  - kartu_keluarga_no: varchar (nullable), len=50
  - ktp_no: varchar (nullable), len=50
  - npwp: varchar (nullable), len=50
  - created_at: datetime2
  - created_by: nvarchar (nullable), len=50
  - updated_at: datetime2 (nullable)
  - updated_by: nvarchar (nullable), len=50
  - version_number: int, precision=10
  - branch_id: nvarchar (nullable), len=255
  - Branch: nvarchar (nullable), len=255
  - office_email: nvarchar (nullable), len=255
  - month_of_birthday: nvarchar (nullable), len=255
  - id_card_mti: bit (nullable)
  - Field: nvarchar (nullable), len=255
- Primary Key: employee_id

## dbo.employee_employment
- Columns:
  - employee_id: varchar, len=20
  - company_office: varchar (nullable), len=100
  - work_location: varchar (nullable), len=100
  - division: varchar (nullable), len=100
  - department: varchar (nullable), len=100
  - section: varchar (nullable), len=100
  - direct_report: varchar (nullable), len=100
  - job_title: varchar (nullable), len=100
  - grade: varchar (nullable), len=20
  - position_grade: varchar (nullable), len=20
  - group_job_title: varchar (nullable), len=100
  - terminated_date: date (nullable)
  - terminated_type: varchar (nullable), len=50
  - terminated_reason: varchar (nullable), len=200
  - blacklist_mti: varchar (nullable), len=1
  - blacklist_imip: varchar (nullable), len=1
  - status: varchar (nullable), len=50
  - employment_status: varchar, len=30
  - locality_status: varchar (nullable), len=20
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_employment_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_employment_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.employee_insurance
- Columns:
  - employee_id: varchar, len=20
  - insurance_endorsement: varchar (nullable), len=1
  - insurance_owlexa: varchar (nullable), len=1
  - insurance_fpg: varchar (nullable), len=1
  - bpjs_tk: varchar (nullable), len=50
  - bpjs_kes: varchar (nullable), len=50
  - status_bpjs_kes: varchar (nullable), len=50
  - social_insurance_no_alt: nvarchar (nullable), len=255
  - bpjs_kes_no_alt: nvarchar (nullable), len=255
  - fpg_no: nvarchar (nullable), len=255
  - owlexa_no: nvarchar (nullable), len=255
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_insurance_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_insurance_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.employee_notes
- Columns:
  - note_id: int, precision=10
  - employee_id: varchar, len=255
  - Batch: nvarchar (nullable), len=255
  - CekDocumentNote: nvarchar (nullable), len=255
  - created_at: datetime2
  - updated_at: datetime2
  - note: varchar (nullable), len=-1
- Primary Key: note_id

## dbo.employee_onboard
- Columns:
  - employee_id: varchar, len=20
  - point_of_hire: varchar (nullable), len=100
  - point_of_origin: varchar (nullable), len=100
  - schedule_type: varchar (nullable), len=50
  - first_join_date_merdeka: date (nullable)
  - transfer_merdeka: date (nullable)
  - first_join_date: date (nullable)
  - join_date: date (nullable)
  - employment_status: varchar (nullable), len=50
  - end_contract: date (nullable)
  - years_in_service: int (nullable), precision=10
  - created_at: datetime2
  - created_by: nvarchar (nullable), len=50
  - updated_at: datetime2 (nullable)
  - updated_by: nvarchar (nullable), len=50
  - version_number: int, precision=10
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_onboard_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_onboard_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.employee_travel
- Columns:
  - employee_id: varchar, len=20
  - travel_in: date (nullable)
  - travel_out: date (nullable)
  - passport_no: varchar (nullable), len=50
  - kitas_no: varchar (nullable), len=50
  - name_as_passport: nvarchar (nullable), len=255
  - passport_expiry: datetime2 (nullable)
  - kitas_expiry: datetime2 (nullable)
  - IMTA: nvarchar (nullable), len=255
  - rptka_no: nvarchar (nullable), len=255
  - rptka_position: nvarchar (nullable), len=255
  - kitas_address: nvarchar (nullable), len=255
  - job_title_kitas: nvarchar (nullable), len=255
- Primary Key: employee_id
- Foreign Keys:
  - FK_employee_travel_employee_core: employee_id → dbo.employee_core(employee_id)
  - FK_employee_travel_employee_core_employee_id: employee_id → dbo.employee_core(employee_id)

## dbo.login
- Columns:
  - Id: int, precision=10
  - username: varchar, len=50
  - password: varchar, len=255
  - Role: varchar, len=50
  - name: varchar, len=100
  - department: varchar, len=100
  - created_at: datetime2
  - created_by: nvarchar (nullable), len=50
  - updated_at: datetime2 (nullable)
  - updated_by: nvarchar (nullable), len=50
  - last_login: datetime2 (nullable)
  - login_count: int, precision=10
  - account_locked: bit
  - locked_until: datetime2 (nullable)
  - password_changed_at: datetime2 (nullable)
  - must_change_password: bit
  - auth_type: nvarchar, len=20
  - domain_username: nvarchar (nullable), len=100
  - last_domain_sync: datetime2 (nullable)
- Primary Key: Id

## dbo.login_attempts
- Columns:
  - attempt_id: bigint, precision=19
  - username: nvarchar, len=50
  - ip_address: nvarchar, len=45
  - user_agent: nvarchar (nullable), len=500
  - attempt_time: datetime2
  - success: bit
  - failure_reason: nvarchar (nullable), len=200
  - session_id: nvarchar (nullable), len=128
- Primary Key: attempt_id

## dbo.permissions
- Columns:
  - permission_id: int, precision=10
  - module_name: nvarchar, len=50
  - action_name: nvarchar, len=50
  - permission_key: nvarchar, len=100
  - description: nvarchar (nullable), len=500
  - is_active: bit
  - created_at: datetime2
- Primary Key: permission_id

## dbo.report_history
- Columns:
  - history_id: bigint, precision=19
  - report_id: nvarchar, len=100
  - title: nvarchar, len=255
  - type: nvarchar, len=50
  - user_id: int (nullable), precision=10
  - filters: nvarchar (nullable), len=-1
  - record_count: int, precision=10
  - file_path: nvarchar (nullable), len=500
  - file_size: bigint (nullable), precision=19
  - export_format: nvarchar (nullable), len=20
  - status: nvarchar, len=20
  - error_message: nvarchar (nullable), len=-1
  - execution_time_ms: int (nullable), precision=10
  - created_at: datetime2
  - expires_at: datetime2 (nullable)
- Primary Key: history_id

## dbo.report_schedules
- Columns:
  - schedule_id: int, precision=10
  - schedule_name: nvarchar, len=100
  - template_id: int, precision=10
  - user_id: int, precision=10
  - cron_expression: nvarchar, len=100
  - filters: nvarchar (nullable), len=-1
  - export_format: nvarchar, len=20
  - email_recipients: nvarchar (nullable), len=-1
  - is_active: bit
  - last_run_at: datetime2 (nullable)
  - next_run_at: datetime2 (nullable)
  - run_count: int, precision=10
  - error_count: int, precision=10
  - last_error: nvarchar (nullable), len=-1
  - created_at: datetime2
  - updated_at: datetime2 (nullable)
- Primary Key: schedule_id
- Foreign Keys:
  - FK__report_sc__templ__31B762FC: template_id → dbo.report_templates(template_id)

## dbo.report_templates
- Columns:
  - template_id: int, precision=10
  - template_name: nvarchar, len=100
  - display_name: nvarchar, len=255
  - description: nvarchar (nullable), len=500
  - category: nvarchar, len=50
  - query_template: nvarchar, len=-1
  - default_filters: nvarchar (nullable), len=-1
  - available_fields: nvarchar (nullable), len=-1
  - chart_config: nvarchar (nullable), len=-1
  - is_active: bit
  - is_system: bit
  - created_by: int (nullable), precision=10
  - created_at: datetime2
  - updated_by: int (nullable), precision=10
  - updated_at: datetime2 (nullable)
- Primary Key: template_id

## dbo.role_column_access
- Columns:
  - id: bigint, precision=19
  - role_id: int, precision=10
  - column_id: int, precision=10
  - can_view: bit
  - can_edit: bit
  - export_allowed: bit
  - created_at: datetime2
  - updated_at: datetime2
- Primary Key: id
- Foreign Keys:
  - FK_role_column_access_column: column_id → dbo.column_catalog(id)
  - FK_role_column_access_roles: role_id → dbo.roles(role_id)

## dbo.role_permissions
- Columns:
  - role_permission_id: int, precision=10
  - role_id: int, precision=10
  - permission_id: int, precision=10
  - granted_by: nvarchar (nullable), len=50
  - granted_at: datetime2
- Primary Key: role_permission_id
- Foreign Keys:
  - FK__role_perm__permi__160F4887: permission_id → dbo.permissions(permission_id)
  - FK__role_perm__role___151B244E: role_id → dbo.roles(role_id)

## dbo.roles
- Columns:
  - role_id: int, precision=10
  - role_name: nvarchar, len=50
  - role_display_name: nvarchar, len=100
  - description: nvarchar (nullable), len=500
  - is_active: bit
  - created_at: datetime2
  - updated_at: datetime2
- Primary Key: role_id

## dbo.system_logs
- Columns:
  - log_id: bigint, precision=19
  - level: nvarchar, len=10
  - message: nvarchar, len=-1
  - category: nvarchar (nullable), len=100
  - user_id: nvarchar (nullable), len=50
  - ip_address: nvarchar (nullable), len=45
  - request_id: nvarchar (nullable), len=128
  - stack_trace: nvarchar (nullable), len=-1
  - additional_data: nvarchar (nullable), len=-1
  - timestamp: datetime2
- Primary Key: log_id

## dbo.user_sessions
- Columns:
  - session_id: nvarchar, len=128
  - user_id: nvarchar, len=50
  - username: nvarchar, len=50
  - ip_address: nvarchar, len=45
  - user_agent: nvarchar (nullable), len=500
  - created_at: datetime2
  - last_activity: datetime2
  - expires_at: datetime2
  - is_active: bit
  - logout_time: datetime2 (nullable)
- Primary Key: session_id

## dbo.vw_report_analytics
- Columns:
  - report_type: nvarchar, len=50
  - total_reports: int (nullable), precision=10
  - unique_users: int (nullable), precision=10
  - avg_execution_time: int (nullable), precision=10
  - total_records_processed: int (nullable), precision=10
  - last_generated: datetime2 (nullable)
  - failed_count: int (nullable), precision=10
  - success_count: int (nullable), precision=10

## dbo.vw_role_column_access
- Columns:
  - role_id: int (nullable), precision=10
  - role_name: nvarchar (nullable), len=50
  - column_id: int, precision=10
  - table_name: nvarchar, len=128
  - column_name: nvarchar, len=128
  - display_label: nvarchar (nullable), len=128
  - data_type: nvarchar (nullable), len=64
  - is_exportable: bit
  - is_sensitive: bit
  - can_view: bit (nullable)
  - can_edit: bit (nullable)
  - export_allowed: bit (nullable)

## dbo.vw_role_permissions
- Columns:
  - role_name: nvarchar, len=50
  - role_display_name: nvarchar, len=100
  - module_name: nvarchar, len=50
  - action_name: nvarchar, len=50
  - permission_key: nvarchar, len=100
  - permission_description: nvarchar (nullable), len=500
  - granted_at: datetime2
  - granted_by: nvarchar (nullable), len=50
