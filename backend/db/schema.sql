CREATE TABLE [dbo].[audit_trail] (
  [audit_id] bigint NOT NULL,
  [table_name] nvarchar(128) NOT NULL,
  [record_id] nvarchar(50) NOT NULL,
  [operation_type] nvarchar(10) NOT NULL,
  [old_values] nvarchar(max) NULL,
  [new_values] nvarchar(max) NULL,
  [changed_fields] nvarchar(max) NULL,
  [user_id] nvarchar(50) NULL,
  [user_role] nvarchar(50) NULL,
  [ip_address] nvarchar(45) NULL,
  [user_agent] nvarchar(500) NULL,
  [session_id] nvarchar(128) NULL,
  [timestamp] datetime2 NOT NULL,
  [reason] nvarchar(500) NULL,
  PRIMARY KEY ([audit_id])
);

CREATE TABLE [dbo].[column_access_templates] (
  [template_name] nvarchar(100) NOT NULL,
  [payload] nvarchar(max) NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([template_name])
);

CREATE TABLE [dbo].[column_catalog] (
  [id] int NOT NULL,
  [table_name] nvarchar(128) NOT NULL,
  [column_name] nvarchar(128) NOT NULL,
  [display_label] nvarchar(128) NULL,
  [data_type] nvarchar(64) NULL,
  [is_exportable] bit NOT NULL,
  [is_sensitive] bit NOT NULL,
  [is_active] bit NOT NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [dbo].[dashboard_widgets] (
  [widget_id] int NOT NULL,
  [user_id] int NOT NULL,
  [widget_type] nvarchar(50) NOT NULL,
  [widget_name] nvarchar(100) NOT NULL,
  [position_x] int NOT NULL,
  [position_y] int NOT NULL,
  [width] int NOT NULL,
  [height] int NOT NULL,
  [config] nvarchar(max) NULL,
  [data_source] nvarchar(100) NULL,
  [refresh_interval] int NULL,
  [is_visible] bit NOT NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NULL,
  PRIMARY KEY ([widget_id])
);

CREATE TABLE [dbo].[dbinfo_mappings] (
  [mapping_id] int NOT NULL,
  [excel_table] nvarchar(128) NOT NULL,
  [excel_schema] nvarchar(128) NOT NULL,
  [excel_column] nvarchar(128) NOT NULL,
  [excel_name] nvarchar(256) NULL,
  [matched_table] nvarchar(256) NULL,
  [matched_column] nvarchar(128) NULL,
  [matched_type] nvarchar(64) NULL,
  [status] nvarchar(32) NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([mapping_id])
);

CREATE TABLE [dbo].[employee_bank] (
  [employee_id] varchar(20) NOT NULL,
  [bank_name] varchar(50) NULL,
  [account_name] varchar(100) NULL,
  [account_no] varchar(100) NULL,
  [bank_code] nvarchar(255) NULL,
  [icbc_bank_account_no] nvarchar(255) NULL,
  [icbc_username] nvarchar(255) NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_checklist] (
  [checklist_id] int NOT NULL,
  [employee_id] varchar(255) NOT NULL,
  [paspor_checklist] bit NULL,
  [kitas_checklist] bit NULL,
  [imta_checklist] bit NULL,
  [rptka_checklist] bit NULL,
  [npwp_checklist] bit NULL,
  [bpjs_kes_checklist] bit NULL,
  [bpjs_tk_checklist] bit NULL,
  [bank_checklist] bit NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([checklist_id])
);

CREATE TABLE [dbo].[employee_contact] (
  [employee_id] varchar(20) NOT NULL,
  [phone_number] varchar(20) NULL,
  [email] varchar(100) NULL,
  [address] varchar(200) NULL,
  [city] varchar(50) NULL,
  [emergency_contact_name] varchar(100) NULL,
  [emergency_contact_phone] varchar(20) NULL,
  [spouse_name] varchar(100) NULL,
  [child_name_1] varchar(100) NULL,
  [child_name_2] varchar(100) NULL,
  [child_name_3] varchar(100) NULL,
  [created_at] datetime2 NOT NULL,
  [created_by] nvarchar(50) NULL,
  [updated_at] datetime2 NULL,
  [updated_by] nvarchar(50) NULL,
  [version_number] int NOT NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_core] (
  [employee_id] varchar(20) NOT NULL,
  [imip_id] varchar(20) NULL,
  [name] varchar(100) NULL,
  [gender] char(1) NULL,
  [place_of_birth] varchar(50) NULL,
  [date_of_birth] date NULL,
  [nationality] varchar(20) NULL,
  [blood_type] varchar(3) NULL,
  [marital_status] varchar(20) NULL,
  [tax_status] varchar(5) NULL,
  [religion] varchar(50) NULL,
  [education] varchar(50) NULL,
  [age] int NULL,
  [kartu_keluarga_no] varchar(50) NULL,
  [ktp_no] varchar(50) NULL,
  [npwp] varchar(50) NULL,
  [created_at] datetime2 NOT NULL,
  [created_by] nvarchar(50) NULL,
  [updated_at] datetime2 NULL,
  [updated_by] nvarchar(50) NULL,
  [version_number] int NOT NULL,
  [branch_id] nvarchar(255) NULL,
  [Branch] nvarchar(255) NULL,
  [office_email] nvarchar(255) NULL,
  [month_of_birthday] nvarchar(255) NULL,
  [id_card_mti] bit NULL,
  [field] nvarchar(255) NULL,
  [residen] bit NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_employment] (
  [employee_id] varchar(20) NOT NULL,
  [company_office] varchar(100) NULL,
  [work_location] varchar(100) NULL,
  [division] varchar(100) NULL,
  [department] varchar(100) NULL,
  [section] varchar(100) NULL,
  [direct_report] varchar(100) NULL,
  [job_title] varchar(100) NULL,
  [grade] varchar(20) NULL,
  [position_grade] varchar(20) NULL,
  [group_job_title] varchar(100) NULL,
  [terminated_date] date NULL,
  [terminated_type] varchar(50) NULL,
  [terminated_reason] varchar(200) NULL,
  [blacklist_mti] varchar(1) NULL,
  [blacklist_imip] varchar(1) NULL,
  [status] varchar(50) NULL,
  [employment_status] varchar(30) NOT NULL,
  [locality_status] varchar(20) NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_insurance] (
  [employee_id] varchar(20) NOT NULL,
  [insurance_endorsement] varchar(1) NULL,
  [insurance_owlexa] varchar(1) NULL,
  [insurance_fpg] varchar(1) NULL,
  [bpjs_tk] varchar(50) NULL,
  [bpjs_kes] varchar(50) NULL,
  [status_bpjs_kes] varchar(50) NULL,
  [social_insurance_no_alt] nvarchar(255) NULL,
  [bpjs_kes_no_alt] nvarchar(255) NULL,
  [fpg_no] nvarchar(255) NULL,
  [owlexa_no] nvarchar(255) NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_notes] (
  [note_id] int NOT NULL,
  [employee_id] varchar(255) NOT NULL,
  [Batch] nvarchar(255) NULL,
  [CekDocumentNote] nvarchar(255) NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NOT NULL,
  [note] varchar(max) NULL,
  PRIMARY KEY ([note_id])
);

CREATE TABLE [dbo].[employee_onboard] (
  [employee_id] varchar(20) NOT NULL,
  [point_of_hire] varchar(100) NULL,
  [point_of_origin] varchar(100) NULL,
  [schedule_type] varchar(50) NULL,
  [first_join_date_merdeka] date NULL,
  [transfer_merdeka] date NULL,
  [first_join_date] date NULL,
  [join_date] date NULL,
  [employment_status] varchar(50) NULL,
  [end_contract] date NULL,
  [years_in_service] int NULL,
  [created_at] datetime2 NOT NULL,
  [created_by] nvarchar(50) NULL,
  [updated_at] datetime2 NULL,
  [updated_by] nvarchar(50) NULL,
  [version_number] int NOT NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[employee_travel] (
  [employee_id] varchar(20) NOT NULL,
  [travel_in] date NULL,
  [travel_out] date NULL,
  [passport_no] varchar(50) NULL,
  [kitas_no] varchar(50) NULL,
  [name_as_passport] nvarchar(255) NULL,
  [passport_expiry] datetime2 NULL,
  [kitas_expiry] datetime2 NULL,
  [IMTA] nvarchar(255) NULL,
  [rptka_no] nvarchar(255) NULL,
  [rptka_position] nvarchar(255) NULL,
  [kitas_address] nvarchar(255) NULL,
  [job_title_kitas] nvarchar(255) NULL,
  PRIMARY KEY ([employee_id])
);

CREATE TABLE [dbo].[gym_live_taps] (
  [Id] int NOT NULL,
  [TrName] nvarchar(200) NULL,
  [TrController] nvarchar(200) NULL,
  [Transaction] nvarchar(100) NULL,
  [CardNo] nvarchar(100) NULL,
  [UnitNo] nvarchar(100) NULL,
  [EmployeeID] nvarchar(50) NULL,
  [TrDate] date NULL,
  [TrTime] varchar(8) NULL,
  [TxnTime] datetime NOT NULL,
  [CreatedAt] datetime NOT NULL,
  PRIMARY KEY ([Id])
);

CREATE TABLE [dbo].[login] (
  [Id] int NOT NULL,
  [username] varchar(50) NOT NULL,
  [password] varchar(255) NOT NULL,
  [Role] varchar(50) NOT NULL,
  [name] varchar(100) NOT NULL,
  [department] varchar(100) NOT NULL,
  [created_at] datetime2 NOT NULL,
  [created_by] nvarchar(50) NULL,
  [updated_at] datetime2 NULL,
  [updated_by] nvarchar(50) NULL,
  [last_login] datetime2 NULL,
  [login_count] int NOT NULL,
  [account_locked] bit NOT NULL,
  [locked_until] datetime2 NULL,
  [password_changed_at] datetime2 NULL,
  [must_change_password] bit NOT NULL,
  [auth_type] nvarchar(20) NOT NULL,
  [domain_username] nvarchar(100) NULL,
  [last_domain_sync] datetime2 NULL,
  PRIMARY KEY ([Id])
);

CREATE TABLE [dbo].[login_attempts] (
  [attempt_id] bigint NOT NULL,
  [username] nvarchar(50) NOT NULL,
  [ip_address] nvarchar(45) NOT NULL,
  [user_agent] nvarchar(500) NULL,
  [attempt_time] datetime2 NOT NULL,
  [success] bit NOT NULL,
  [failure_reason] nvarchar(200) NULL,
  [session_id] nvarchar(128) NULL,
  PRIMARY KEY ([attempt_id])
);

CREATE TABLE [dbo].[permissions] (
  [permission_id] int NOT NULL,
  [module_name] nvarchar(50) NOT NULL,
  [action_name] nvarchar(50) NOT NULL,
  [permission_key] nvarchar(100) NOT NULL,
  [description] nvarchar(500) NULL,
  [is_active] bit NOT NULL,
  [created_at] datetime2 NOT NULL,
  PRIMARY KEY ([permission_id])
);

CREATE TABLE [dbo].[report_history] (
  [history_id] bigint NOT NULL,
  [report_id] nvarchar(100) NOT NULL,
  [title] nvarchar(255) NOT NULL,
  [type] nvarchar(50) NOT NULL,
  [user_id] int NULL,
  [filters] nvarchar(max) NULL,
  [record_count] int NOT NULL,
  [file_path] nvarchar(500) NULL,
  [file_size] bigint NULL,
  [export_format] nvarchar(20) NULL,
  [status] nvarchar(20) NOT NULL,
  [error_message] nvarchar(max) NULL,
  [execution_time_ms] int NULL,
  [created_at] datetime2 NOT NULL,
  [expires_at] datetime2 NULL,
  PRIMARY KEY ([history_id])
);

CREATE TABLE [dbo].[report_schedules] (
  [schedule_id] int NOT NULL,
  [schedule_name] nvarchar(100) NOT NULL,
  [template_id] int NOT NULL,
  [user_id] int NOT NULL,
  [cron_expression] nvarchar(100) NOT NULL,
  [filters] nvarchar(max) NULL,
  [export_format] nvarchar(20) NOT NULL,
  [email_recipients] nvarchar(max) NULL,
  [is_active] bit NOT NULL,
  [last_run_at] datetime2 NULL,
  [next_run_at] datetime2 NULL,
  [run_count] int NOT NULL,
  [error_count] int NOT NULL,
  [last_error] nvarchar(max) NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NULL,
  PRIMARY KEY ([schedule_id])
);

CREATE TABLE [dbo].[report_templates] (
  [template_id] int NOT NULL,
  [template_name] nvarchar(100) NOT NULL,
  [display_name] nvarchar(255) NOT NULL,
  [description] nvarchar(500) NULL,
  [category] nvarchar(50) NOT NULL,
  [query_template] nvarchar(max) NOT NULL,
  [default_filters] nvarchar(max) NULL,
  [available_fields] nvarchar(max) NULL,
  [chart_config] nvarchar(max) NULL,
  [is_active] bit NOT NULL,
  [is_system] bit NOT NULL,
  [created_by] int NULL,
  [created_at] datetime2 NOT NULL,
  [updated_by] int NULL,
  [updated_at] datetime2 NULL,
  PRIMARY KEY ([template_id])
);

CREATE TABLE [dbo].[role_column_access] (
  [id] bigint NOT NULL,
  [role_id] int NOT NULL,
  [column_id] int NOT NULL,
  [can_view] bit NOT NULL,
  [can_edit] bit NOT NULL,
  [export_allowed] bit NOT NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NOT NULL,
  [role] nvarchar(50) NOT NULL,
  [section] nvarchar(50) NOT NULL,
  [column] nvarchar(100) NOT NULL,
  [can_read] bit NOT NULL,
  [can_write] bit NOT NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [dbo].[role_permissions] (
  [role_permission_id] int NOT NULL,
  [role_id] int NOT NULL,
  [permission_id] int NOT NULL,
  [granted_by] nvarchar(50) NULL,
  [granted_at] datetime2 NOT NULL,
  [module] nvarchar(50) NULL,
  [action] nvarchar(50) NULL,
  [allowed] bit NULL,
  PRIMARY KEY ([role_permission_id])
);

CREATE TABLE [dbo].[roles] (
  [role_id] int NOT NULL,
  [role_name] nvarchar(50) NOT NULL,
  [role_display_name] nvarchar(100) NOT NULL,
  [description] nvarchar(500) NULL,
  [is_active] bit NOT NULL,
  [created_at] datetime2 NOT NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([role_id])
);

CREATE TABLE [dbo].[sync_config] (
  [id] int NOT NULL,
  [enabled] bit NOT NULL,
  [schedule] nvarchar(100) NULL,
  [mapping] nvarchar(max) NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([id])
);

CREATE TABLE [dbo].[sync_runs] (
  [run_id] int NOT NULL,
  [started_at] datetime2 NOT NULL,
  [finished_at] datetime2 NULL,
  [success] bit NULL,
  [stats] nvarchar(max) NULL,
  [error] nvarchar(max) NULL,
  PRIMARY KEY ([run_id])
);

CREATE TABLE [dbo].[system_logs] (
  [log_id] bigint NOT NULL,
  [level] nvarchar(10) NOT NULL,
  [message] nvarchar(max) NOT NULL,
  [category] nvarchar(100) NULL,
  [user_id] nvarchar(50) NULL,
  [ip_address] nvarchar(45) NULL,
  [request_id] nvarchar(128) NULL,
  [stack_trace] nvarchar(max) NULL,
  [additional_data] nvarchar(max) NULL,
  [timestamp] datetime2 NOT NULL,
  PRIMARY KEY ([log_id])
);

CREATE TABLE [dbo].[type_column_access] (
  [employee_type] nvarchar(20) NOT NULL,
  [section] nvarchar(50) NOT NULL,
  [column] nvarchar(100) NOT NULL,
  [accessible] bit NOT NULL,
  PRIMARY KEY ([employee_type], [section], [column])
);

CREATE TABLE [dbo].[user_preferences] (
  [pref_id] int NOT NULL,
  [user_id] int NOT NULL,
  [pref_key] nvarchar(100) NOT NULL,
  [pref_value] nvarchar(max) NULL,
  [updated_at] datetime2 NOT NULL,
  PRIMARY KEY ([pref_id])
);

CREATE TABLE [dbo].[user_sessions] (
  [session_id] nvarchar(128) NOT NULL,
  [user_id] nvarchar(50) NOT NULL,
  [username] nvarchar(50) NOT NULL,
  [ip_address] nvarchar(45) NOT NULL,
  [user_agent] nvarchar(500) NULL,
  [created_at] datetime2 NOT NULL,
  [last_activity] datetime2 NOT NULL,
  [expires_at] datetime2 NOT NULL,
  [is_active] bit NOT NULL,
  [logout_time] datetime2 NULL,
  PRIMARY KEY ([session_id])
);

CREATE TABLE [dbo].[vw_report_analytics] (
  [report_type] nvarchar(50) NOT NULL,
  [total_reports] int NULL,
  [unique_users] int NULL,
  [avg_execution_time] int NULL,
  [total_records_processed] int NULL,
  [last_generated] datetime2 NULL,
  [failed_count] int NULL,
  [success_count] int NULL
);

CREATE TABLE [dbo].[vw_role_column_access] (
  [role_id] int NULL,
  [role_name] nvarchar(50) NULL,
  [column_id] int NOT NULL,
  [table_name] nvarchar(128) NOT NULL,
  [column_name] nvarchar(128) NOT NULL,
  [display_label] nvarchar(128) NULL,
  [data_type] nvarchar(64) NULL,
  [is_exportable] bit NOT NULL,
  [is_sensitive] bit NOT NULL,
  [can_view] bit NULL,
  [can_edit] bit NULL,
  [export_allowed] bit NULL
);

CREATE TABLE [dbo].[vw_role_permissions] (
  [role_name] nvarchar(50) NOT NULL,
  [role_display_name] nvarchar(100) NOT NULL,
  [module_name] nvarchar(50) NOT NULL,
  [action_name] nvarchar(50) NOT NULL,
  [permission_key] nvarchar(100) NOT NULL,
  [permission_description] nvarchar(500) NULL,
  [granted_at] datetime2 NOT NULL,
  [granted_by] nvarchar(50) NULL
);

ALTER TABLE [dbo].[employee_bank] ADD CONSTRAINT [FK_employee_bank_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_bank] ADD CONSTRAINT [FK_employee_bank_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_contact] ADD CONSTRAINT [FK_employee_contact_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_contact] ADD CONSTRAINT [FK_employee_contact_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_employment] ADD CONSTRAINT [FK_employee_employment_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_employment] ADD CONSTRAINT [FK_employee_employment_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_insurance] ADD CONSTRAINT [FK_employee_insurance_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_insurance] ADD CONSTRAINT [FK_employee_insurance_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_onboard] ADD CONSTRAINT [FK_employee_onboard_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_onboard] ADD CONSTRAINT [FK_employee_onboard_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_travel] ADD CONSTRAINT [FK_employee_travel_employee_core] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[employee_travel] ADD CONSTRAINT [FK_employee_travel_employee_core_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[employee_core] ([employee_id]);
ALTER TABLE [dbo].[report_schedules] ADD CONSTRAINT [FK__report_sc__templ__31B762FC] FOREIGN KEY ([template_id]) REFERENCES [dbo].[report_templates] ([template_id]);
ALTER TABLE [dbo].[role_column_access] ADD CONSTRAINT [FK_role_column_access_column] FOREIGN KEY ([column_id]) REFERENCES [dbo].[column_catalog] ([id]);
ALTER TABLE [dbo].[role_column_access] ADD CONSTRAINT [FK_role_column_access_roles] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles] ([role_id]);
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [FK__role_perm__permi__160F4887] FOREIGN KEY ([permission_id]) REFERENCES [dbo].[permissions] ([permission_id]);
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [FK__role_perm__role___151B244E] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles] ([role_id]);