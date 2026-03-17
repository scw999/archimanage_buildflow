import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const UserRole = ["SUPER_ADMIN", "PM", "MEMBER", "CLIENT"] as const;
export const ProjectPhase = ["DESIGN", "PERMIT", "CONSTRUCTION", "COMPLETION", "PORTFOLIO"] as const;
export const ProjectStatus = ["ACTIVE", "COMPLETED", "ON_HOLD"] as const;
export const MemberRole = ["PM", "MEMBER", "CLIENT"] as const;
export const ScheduleCategory = ["MEETING", "DEADLINE", "INSPECTION", "CONSTRUCTION"] as const;
export const FileCategory = ["DRAWING", "STRUCTURAL", "INTERIOR", "DOCUMENT", "OTHER"] as const;
export const RequestStatus = ["NEW", "REVIEWING", "IN_PROGRESS", "RESOLVED", "ON_HOLD", "REJECTED"] as const;
export const RequestPriority = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export const RequestCategory = ["DESIGN_CHANGE", "MATERIAL_CHANGE", "ADDITIONAL_WORK", "SCHEDULE_CHANGE", "OTHER"] as const;

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<typeof UserRole[number]>(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  avatarUrl: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  clientName: text("client_name"),
  address: text("address"),
  currentPhase: text("current_phase").notNull().$type<typeof ProjectPhase[number]>(),
  status: text("status").notNull().$type<typeof ProjectStatus[number]>(),
  coverImageUrl: text("cover_image_url"),
  buildingArea: text("building_area"),
  totalFloorArea: text("total_floor_area"),
  buildingCoverage: text("building_coverage"),
  floorAreaRatio: text("floor_area_ratio"),
  floors: text("floors"),
  basementFloors: integer("basement_floors"),
  aboveFloors: integer("above_floors"),
  structureType: text("structure_type"),
  mainUse: text("main_use"),
  specialNotes: text("special_notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  clientName: true,
  address: true,
  currentPhase: true,
  status: true,
  coverImageUrl: true,
  buildingArea: true,
  totalFloorArea: true,
  buildingCoverage: true,
  floorAreaRatio: true,
  floors: true,
  basementFloors: true,
  aboveFloors: true,
  structureType: true,
  mainUse: true,
  specialNotes: true,
  createdBy: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ProjectMembers
export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().$type<typeof MemberRole[number]>(),
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).pick({
  projectId: true,
  userId: true,
  role: true,
});

export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// Schedules
export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().$type<typeof ProjectPhase[number]>(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  category: text("category").notNull().$type<typeof ScheduleCategory[number]>(),
  memo: text("memo"),
  location: text("location"),
  time: text("time"),
  createdBy: varchar("created_by"),
});

export const insertScheduleSchema = createInsertSchema(schedules).pick({
  projectId: true,
  phase: true,
  title: true,
  date: true,
  category: true,
  memo: true,
  location: true,
  time: true,
  createdBy: true,
});

export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

// DailyLogs
export const dailyLogs = pgTable("daily_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().$type<typeof ProjectPhase[number]>(),
  date: text("date").notNull(),
  content: text("content").notNull(),
  weather: text("weather"),
  workers: integer("workers"),
  createdBy: varchar("created_by"),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).pick({
  projectId: true,
  phase: true,
  date: true,
  content: true,
  weather: true,
  workers: true,
  createdBy: true,
});

export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

// Files
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().$type<typeof ProjectPhase[number]>(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull().$type<typeof FileCategory[number]>(),
  version: text("version"),
  description: text("description"),
  createdBy: varchar("created_by"),
});

export const insertFileSchema = createInsertSchema(files).pick({
  projectId: true,
  phase: true,
  title: true,
  url: true,
  category: true,
  version: true,
  description: true,
  createdBy: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// Photos
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().$type<typeof ProjectPhase[number]>(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  description: text("description"),
  tags: text("tags"),
  takenAt: text("taken_at"),
  subCategory: text("sub_category"),
  createdBy: varchar("created_by"),
});

export const insertPhotoSchema = createInsertSchema(photos).pick({
  projectId: true,
  phase: true,
  imageUrl: true,
  thumbnailUrl: true,
  description: true,
  tags: true,
  takenAt: true,
  subCategory: true,
  createdBy: true,
});

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

// ClientRequests
export const clientRequests = pgTable("client_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().$type<typeof ProjectPhase[number]>(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().$type<typeof RequestStatus[number]>(),
  priority: text("priority").notNull().$type<typeof RequestPriority[number]>(),
  category: text("category").notNull().$type<typeof RequestCategory[number]>(),
  assigneeId: varchar("assignee_id"),
  attachments: text("attachments"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertClientRequestSchema = createInsertSchema(clientRequests).pick({
  projectId: true,
  phase: true,
  title: true,
  content: true,
  status: true,
  priority: true,
  category: true,
  assigneeId: true,
  attachments: true,
  createdBy: true,
});

export type InsertClientRequest = z.infer<typeof insertClientRequestSchema>;
export type ClientRequest = typeof clientRequests.$inferSelect;

// Comments
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientRequestId: varchar("client_request_id").notNull(),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  clientRequestId: true,
  authorId: true,
  content: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Design change tracking
export const DesignChangeStatus = ["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "APPLIED"] as const;

export const designChanges = pgTable("design_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reason: text("reason"),
  impactArea: text("impact_area"),
  status: text("status").notNull().$type<typeof DesignChangeStatus[number]>(),
  requestedBy: varchar("requested_by"),
  approvedBy: varchar("approved_by"),
  relatedFileId: varchar("related_file_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDesignChangeSchema = createInsertSchema(designChanges).pick({
  projectId: true,
  title: true,
  description: true,
  reason: true,
  impactArea: true,
  status: true,
  requestedBy: true,
  approvedBy: true,
  relatedFileId: true,
});

export type InsertDesignChange = z.infer<typeof insertDesignChangeSchema>;
export type DesignChange = typeof designChanges.$inferSelect;

// Checklist items (설계/시공 체크리스트)
export const DesignCheckCategory = ["ARCHITECTURE", "STRUCTURE", "MEP", "INTERIOR", "LANDSCAPE", "PERMIT_DOC"] as const;
export const ConstructionCheckCategory = ["가설", "토공", "기초", "골조", "방수", "석공", "타일", "목공", "창호", "도장", "단열", "지붕", "전기", "설비", "소방", "마감", "조경", "기타"] as const;

export const designChecks = pgTable("design_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull().default("DESIGN"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  isCompleted: integer("is_completed").notNull().default(0),
  completedBy: varchar("completed_by"),
  completedAt: timestamp("completed_at"),
  memo: text("memo"),
  linkedToConstruction: integer("linked_to_construction").notNull().default(0),
  attachments: text("attachments"),
});

export const insertDesignCheckSchema = createInsertSchema(designChecks).pick({
  projectId: true,
  phase: true,
  category: true,
  title: true,
  isCompleted: true,
  completedBy: true,
  memo: true,
  linkedToConstruction: true,
  attachments: true,
});

export type InsertDesignCheck = z.infer<typeof insertDesignCheckSchema>;
export type DesignCheck = typeof designChecks.$inferSelect;

// Construction tasks (공정 관리)
export const TaskStatus = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED"] as const;

export const constructionTasks = pgTable("construction_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  status: text("status").notNull().$type<typeof TaskStatus[number]>(),
  progress: integer("progress").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  assignee: text("assignee"),
  sortOrder: integer("sort_order").notNull().default(0),
  memo: text("memo"),
  checklist: text("checklist"),
  createdBy: varchar("created_by"),
});

export const insertConstructionTaskSchema = createInsertSchema(constructionTasks).pick({
  projectId: true,
  title: true,
  description: true,
  category: true,
  status: true,
  progress: true,
  startDate: true,
  endDate: true,
  assignee: true,
  sortOrder: true,
  memo: true,
  checklist: true,
  createdBy: true,
});

export type InsertConstructionTask = z.infer<typeof insertConstructionTaskSchema>;
export type ConstructionTask = typeof constructionTasks.$inferSelect;

// Inspections (검수)
export const InspectionResult = ["PASS", "CONDITIONAL_PASS", "FAIL", "PENDING"] as const;

export const inspections = pgTable("inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  result: text("result").notNull().$type<typeof InspectionResult[number]>(),
  inspector: text("inspector"),
  findings: text("findings"),
  createdBy: varchar("created_by"),
});

export const insertInspectionSchema = createInsertSchema(inspections).pick({
  projectId: true,
  title: true,
  category: true,
  scheduledDate: true,
  completedDate: true,
  result: true,
  inspector: true,
  findings: true,
  createdBy: true,
});

export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// Defects (하자 관리)
export const DefectSeverity = ["CRITICAL", "MAJOR", "MINOR", "COSMETIC"] as const;
export const DefectStatus = ["OPEN", "IN_REPAIR", "REPAIRED", "VERIFIED", "CLOSED"] as const;

export const defects = pgTable("defects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  severity: text("severity").notNull().$type<typeof DefectSeverity[number]>(),
  status: text("status").notNull().$type<typeof DefectStatus[number]>(),
  reportedBy: varchar("reported_by"),
  assignee: text("assignee"),
  reportedAt: timestamp("reported_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertDefectSchema = createInsertSchema(defects).pick({
  projectId: true,
  title: true,
  description: true,
  location: true,
  severity: true,
  status: true,
  reportedBy: true,
  assignee: true,
});

export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;
