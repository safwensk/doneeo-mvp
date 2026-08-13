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
});

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
