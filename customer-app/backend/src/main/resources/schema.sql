CREATE TABLE IF NOT EXISTS customer_accounts (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(100) NOT NULL
);

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
