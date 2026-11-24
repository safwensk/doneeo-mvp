CREATE TABLE IF NOT EXISTS customer_accounts (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS executor_profiles (
    account_id VARCHAR(36) PRIMARY KEY REFERENCES customer_accounts(id),
    profile_json CLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS executor_profile_drafts (
    account_id VARCHAR(36) PRIMARY KEY REFERENCES customer_accounts(id),
    profile_json CLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS executor_assets (
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    kind VARCHAR(16) NOT NULL,
    content_type VARCHAR(30) NOT NULL,
    encrypted_content BLOB,
    status VARCHAR(20) NOT NULL,
    note VARCHAR(400) NOT NULL,
    revision VARCHAR(36) NOT NULL,
    PRIMARY KEY (account_id, kind)
);

CREATE TABLE IF NOT EXISTS executor_jobs (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES executor_profiles(account_id),
    start_at BIGINT NOT NULL,
    end_at BIGINT NOT NULL,
    status VARCHAR(18) NOT NULL,
    progress INTEGER NOT NULL,
    equipment_hold INTEGER NOT NULL,
    plan_json CLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS executor_jobs_calendar ON executor_jobs(account_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS executor_job_messages (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES executor_jobs(id),
    kind VARCHAR(20) NOT NULL,
    message VARCHAR(800) NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS executor_notifications (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    job_id VARCHAR(36) REFERENCES executor_jobs(id),
    title VARCHAR(120) NOT NULL,
    message VARCHAR(300) NOT NULL,
    created_at BIGINT NOT NULL,
    seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS executor_notifications_account ON executor_notifications(account_id, created_at);

CREATE TABLE IF NOT EXISTS customer_conversations (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    original_request VARCHAR(2000) NOT NULL,
    answers_json CLOB NOT NULL DEFAULT '{}',
    messages_json CLOB NOT NULL DEFAULT '[]',
    planner_result CLOB,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS conversations_by_account
    ON customer_conversations(account_id, updated_at);

CREATE TABLE IF NOT EXISTS customer_chat_operations (
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    operation_id VARCHAR(36) NOT NULL,
    conversation_id VARCHAR(36) NOT NULL REFERENCES customer_conversations(id),
    payload_hash VARCHAR(64) NOT NULL,
    response_json CLOB NOT NULL,
    PRIMARY KEY (account_id, operation_id)
);

CREATE TABLE IF NOT EXISTS customer_workspaces (
    work_case_id VARCHAR(100) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    job_order_id VARCHAR(100) NOT NULL,
    planner_result CLOB NOT NULL,
    updated_at VARCHAR(40) NOT NULL
);
CREATE INDEX IF NOT EXISTS workspaces_by_account
    ON customer_workspaces(account_id, updated_at);

CREATE TABLE IF NOT EXISTS customer_workspace_operations (
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    operation_id VARCHAR(250) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    response_json CLOB NOT NULL,
    PRIMARY KEY (account_id, operation_id)
);

CREATE TABLE IF NOT EXISTS customer_work_orders (
    public_reference VARCHAR(100) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES customer_accounts(id),
    work_case_id VARCHAR(100) NOT NULL REFERENCES customer_workspaces(work_case_id)
);
