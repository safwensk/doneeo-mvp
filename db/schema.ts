import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const executors = sqliteTable("executors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  profileType: text("profile_type", { enum: ["solo", "team"] }).notNull(),
  status: text("status", { enum: ["available", "busy", "offline"] }).notNull().default("available"),
  rating: real("rating").notNull(),
  completedJobs: integer("completed_jobs").notNull().default(0),
  location: text("location").notNull(),
  serviceRadiusKm: integer("service_radius_km").notNull().default(20),
  teamSize: integer("team_size").notNull().default(1),
  leadEligible: integer("lead_eligible", { mode: "boolean" }).notNull().default(false),
  vehicle: text("vehicle"),
  hourlyRate: integer("hourly_rate").notNull(),
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  regulated: integer("regulated", { mode: "boolean" }).notNull().default(false),
});

export const executorSkills = sqliteTable("executor_skills", {
  executorId: text("executor_id").notNull().references(() => executors.id),
  skillId: text("skill_id").notNull().references(() => skills.id),
  level: text("level", { enum: ["support", "experienced", "expert"] }).notNull(),
}, table => [primaryKey({ columns: [table.executorId, table.skillId] })]);

export const equipmentCatalog = sqliteTable("equipment_catalog", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
});

export const executorEquipment = sqliteTable("executor_equipment", {
  executorId: text("executor_id").notNull().references(() => executors.id),
  equipmentId: text("equipment_id").notNull().references(() => equipmentCatalog.id),
  quantity: integer("quantity").notNull().default(1),
  verified: integer("verified", { mode: "boolean" }).notNull().default(true),
}, table => [primaryKey({ columns: [table.executorId, table.equipmentId] })]);

export const rentalPartners = sqliteTable("rental_partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  pickupLeadMinutes: integer("pickup_lead_minutes").notNull().default(20),
  deliveryAvailable: integer("delivery_available", { mode: "boolean" }).notNull().default(false),
});

export const rentalInventory = sqliteTable("rental_inventory", {
  partnerId: text("partner_id").notNull().references(() => rentalPartners.id),
  equipmentId: text("equipment_id").notNull().references(() => equipmentCatalog.id),
  quantityAvailable: integer("quantity_available").notNull().default(0),
  dailyPrice: integer("daily_price").notNull(),
  deposit: integer("deposit").notNull().default(0),
}, table => [primaryKey({ columns: [table.partnerId, table.equipmentId] })]);

export const workOrders = sqliteTable("work_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicReference: text("public_reference").notNull().unique(),
  /** Links the operational projection to the one canonical WorkCase. Demo
   *  fixtures may remain null, but customer-created orders must provide it. */
  workCaseId: text("work_case_id").references(() => workCases.workCaseId),
  jobOrderId: text("job_order_id"),
  requirementContractRef: text("requirement_contract_ref"),
  requestText: text("request_text").notNull(),
  category: text("category").notNull(),
  city: text("city").notNull().default("Montréal"),
  pickupAddress: text("pickup_address"),
  deliveryAddress: text("delivery_address"),
  scheduleText: text("schedule_text"),
  selectedPlan: text("selected_plan"),
  requiredTeamSize: integer("required_team_size").notNull().default(1),
  requiredSkillsJson: text("required_skills_json").notNull().default("[]"),
  requiredEquipmentJson: text("required_equipment_json").notNull().default("[]"),
  price: integer("price").notNull().default(0),
  status: text("status", { enum: ["draft", "matching", "team_pending", "equipment_check", "ready", "in_progress", "awaiting_customer", "completed", "rematching"] }).notNull().default("matching"),
  createdAt: text("created_at").notNull(),
}, table => [
  uniqueIndex("work_orders_work_case_unique").on(table.workCaseId),
  uniqueIndex("work_orders_job_order_unique").on(table.jobOrderId),
]);

export const workOrderStops = sqliteTable("work_order_stops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  stopOrder: integer("stop_order").notNull(),
  stopType: text("stop_type", { enum: ["pickup", "delivery_pickup", "delivery", "rental_pickup", "rental_return", "service"] }).notNull(),
  address: text("address").notNull(),
  actionsJson: text("actions_json").notNull().default("[]"),
  accessJson: text("access_json").notNull().default("{}"),
  contactName: text("contact_name"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(0),
}, table => [uniqueIndex("work_order_stop_order_idx").on(table.workOrderId, table.stopOrder)]);

export const workOrderEvents = sqliteTable("work_order_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
});

export const assignments = sqliteTable("assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  executorId: text("executor_id").notNull().references(() => executors.id),
  role: text("role").notNull(),
  isLead: integer("is_lead", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["offered", "accepted", "declined", "replaced"] }).notNull().default("offered"),
  offeredAt: text("offered_at").notNull(),
  respondedAt: text("responded_at"),
}, table => [uniqueIndex("assignment_order_executor_idx").on(table.workOrderId, table.executorId)]);

export const equipmentResponses = sqliteTable("equipment_responses", {
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  executorId: text("executor_id").notNull().references(() => executors.id),
  equipmentId: text("equipment_id").notNull().references(() => equipmentCatalog.id),
  profileListed: integer("profile_listed", { mode: "boolean" }).notNull().default(false),
  response: text("response", { enum: ["pending", "bringing", "not_available"] }).notNull().default("pending"),
  respondedAt: text("responded_at"),
}, table => [primaryKey({ columns: [table.workOrderId, table.executorId, table.equipmentId] })]);

export const rentalReservations = sqliteTable("rental_reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  partnerId: text("partner_id").notNull().references(() => rentalPartners.id),
  equipmentId: text("equipment_id").notNull().references(() => equipmentCatalog.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  status: text("status", { enum: ["reserved", "collected", "returned", "cancelled"] }).notNull().default("reserved"),
  pickupByExecutorId: text("pickup_by_executor_id").references(() => executors.id),
  createdAt: text("created_at").notNull(),
});

/* ==================================================================== *
 * Control spine — Platform Architecture §12 P0/P1
 *
 * Added 2026-08-18. These four tables are the boundary between the
 * Intelligence layer and everything downstream. Domain logic lives in
 * lib/requirement-contract.ts and lib/domain-events.ts; these are storage
 * only. See those modules for the invariants each column protects.
 * ==================================================================== */

/**
 * A versioned, immutable snapshot of what the customer approved.
 *
 * (contractId, version) is the primary key: one row per version, never an
 * update in place. Superseding inserts a new row and marks the old one.
 */
export const requirementContracts = sqliteTable("requirement_contracts", {
  contractId: text("contract_id").notNull(),
  version: integer("version").notNull(),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "SUPERSEDED"] }).notNull().default("DRAFT"),
  /** Serialized JobIntelligence. Immutable once status is PUBLISHED. */
  content: text("content").notNull(),
  /** Deterministic digest of content — equal hashes mean an equal plan. */
  contentHash: text("content_hash").notNull(),
  publishedAt: text("published_at"),
  supersededBy: integer("superseded_by"),
  supersedeReason: text("supersede_reason"),
  correlationId: text("correlation_id").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [
  primaryKey({ columns: [table.contractId, table.version] }),
  /** At most one PUBLISHED version per contract. Enforces in the database the
   *  invariant currentVersion() enforces in the domain, so a forked lineage
   *  cannot be created by two concurrent writers. */
  uniqueIndex("requirement_contract_single_current_idx")
    .on(table.contractId)
    .where(sql`${table.status} = 'PUBLISHED'`),
]);

/**
 * The three-lifecycle TaskBlock split.
 *
 * requirementId is stable for the life of the WorkCase. fulfillmentId clears on
 * provider decline; executionId clears on re-execution. Keeping them in separate
 * columns is what stops a decline from invalidating the customer's requirement.
 */
export const taskBlockIdentities = sqliteTable("task_block_identities", {
  contractId: text("contract_id").notNull(),
  contractVersion: integer("contract_version").notNull(),
  requirementId: text("requirement_id").notNull(),
  /** SHA-256 over the provider-accepted projection of this task. Carry-forward
   *  on supersession is decided by comparing this, not by reusing the id. */
  acceptanceFingerprint: text("acceptance_fingerprint").notNull(),
  fulfillmentId: text("fulfillment_id"),
  executionId: text("execution_id"),
  updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.contractId, table.contractVersion, table.requirementId] })]);

/**
 * Append-only event store. Never updated, never deleted.
 *
 * (streamId, sequence) is unique — the optimistic-concurrency guard. Two writers
 * racing on the same stream produce a constraint violation rather than a lost
 * write, which is the property that makes forward-only physical work safe.
 */
export const domainEvents = sqliteTable("domain_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  streamId: text("stream_id").notNull(),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  correlationId: text("correlation_id").notNull(),
  causationId: text("causation_id"),
  occurredAt: text("occurred_at").notNull(),
}, table => [uniqueIndex("domain_events_stream_sequence").on(table.streamId, table.sequence)]);

/**
 * Idempotency ledger.
 *
 * A retried command with the same key returns the recorded result instead of
 * repeating the effect. Physical work is forward-only: a duplicated dispatch
 * means a second crew at someone's door.
 */
export const commandLog = sqliteTable("command_log", {
  commandKey: text("command_key").primaryKey(),
  commandType: text("command_type").notNull(),
  /** Digest of the command arguments — detects key reuse with different intent. */
  requestHash: text("request_hash").notNull(),
  status: text("status", { enum: ["IN_FLIGHT", "SUCCEEDED", "FAILED"] }).notNull(),
  result: text("result"),
  correlationId: text("correlation_id").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

/* ==================================================================== *
 * WorkCase control plane — server-owned workflow identity
 *
 * Added 2026-08-18 from the Atlas backend recovery. The frontend must not own
 * progression (§28 anti-pattern #8); these tables are where authoritative
 * workflow state lives. Domain logic is in lib/work-case.ts and
 * lib/intelligence-task-identity.ts.
 * ==================================================================== */

/** One per customer job. Holds the current state and the version pointers. */
export const workCases = sqliteTable("work_cases", {
  workCaseId: text("work_case_id").primaryKey(),
  jobOrderId: text("job_order_id").notNull(),
  state: text("state").notNull(),
  /** Canonical L01-L13 position. Detailed workflow state can change without
   *  inventing a second lifecycle or losing the layer during an exception. */
  currentLayerId: text("current_layer_id").notNull().default("L01"),
  /** Incremented on every transition; commands carry an expected value so a
   *  stale client cannot apply a transition computed against an older state. */
  stateVersion: integer("state_version").notNull(),
  currentRequirementRef: text("current_requirement_ref"),
  currentFulfillmentRef: text("current_fulfillment_ref"),
  currentExecutionRef: text("current_execution_ref"),
  currentOutcomeRef: text("current_outcome_ref"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("work_cases_job_order_unique").on(table.jobOrderId)]);

/**
 * The customer's original request, held server-side.
 *
 * Client-submitted text is not transactional truth — re-analysis reads from
 * here so a modified client payload cannot silently redefine the job.
 */
export const intelligenceRequests = sqliteTable("intelligence_requests", {
  workCaseId: text("work_case_id").primaryKey().references(() => workCases.workCaseId),
  rawRequest: text("raw_request").notNull(),
  confirmedAnswersJson: text("confirmed_answers_json").notNull().default("{}"),
  latestAnalysisJson: text("latest_analysis_json"),
  createdAt: text("created_at").notNull(),
});

/**
 * Stable TaskBlock identity, owned by Intelligence and independent of provider state.
 *
 * The same requested outcome keeps its id when it moves position between analysis
 * rounds; a removed outcome is retired explicitly rather than disappearing.
 */
export const intelligenceTaskIdentities = sqliteTable("intelligence_task_identities", {
  workCaseId: text("work_case_id").notNull().references(() => workCases.workCaseId),
  taskId: text("task_id").notNull(),
  semanticKey: text("semantic_key").notNull(),
  ordinal: integer("ordinal").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [
  primaryKey({ columns: [table.workCaseId, table.taskId] }),
  /** One ACTIVE task per semantic key — retired tasks may share it historically. */
  uniqueIndex("intelligence_task_active_semantic_key_idx")
    .on(table.workCaseId, table.semanticKey)
    .where(sql`${table.status} = 'ACTIVE'`),
]);
