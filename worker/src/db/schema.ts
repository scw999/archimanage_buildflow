import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums (shared as const arrays for type safety)
export const UserRole = ["SUPER_ADMIN", "PM", "MEMBER", "CLIENT"] as const;
export const ProjectPhase = ["DESIGN", "PERMIT", "CONSTRUCTION", "COMPLETION", "PORTFOLIO"] as const;
export const ProjectStatus = ["ACTIVE", "COMPLETED", "ON_HOLD"] as const;
export const MemberRole = ["PM", "MEMBER", "CLIENT"] as const;
export const ScheduleCategory = ["MEETING", "DEADLINE", "INSPECTION", "CONSTRUCTION"] as const;
export const FileCategory = ["DRAWING", "STRUCTURAL", "INTERIOR", "DOCUMENT", "OTHER"] as const;
export const RequestStatus = ["NEW", "REVIEWING", "IN_PROGRESS", "RESOLVED", "ON_HOLD", "REJECTED"] as const;
export const RequestPriority = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export const RequestCategory = ["DESIGN_CHANGE", "MATERIAL_CHANGE", "ADDITIONAL_WORK", "SCHEDULE_CHANGE", "OTHER"] as const;
export const DesignChangeStatus = ["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "APPLIED"] as const;
export const DesignCheckCategory = ["ARCHITECTURE", "STRUCTURE", "MEP", "INTERIOR", "LANDSCAPE", "PERMIT_DOC"] as const;
export const ConstructionCheckCategory = ["가설", "토공", "기초", "골조", "방수", "석공", "타일", "목공", "창호", "도장", "단열", "지붕", "전기", "설비", "소방", "마감", "조경", "기타"] as const;
export const TaskStatus = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED"] as const;
export const InspectionResult = ["PASS", "CONDITIONAL_PASS", "FAIL", "PENDING"] as const;
export const DefectSeverity = ["CRITICAL", "MAJOR", "MINOR", "COSMETIC"] as const;
export const DefectStatus = ["OPEN", "IN_REPAIR", "REPAIRED", "VERIFIED", "CLOSED"] as const;

// Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true, password: true, name: true, role: true, avatarUrl: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Projects
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  clientName: text("client_name"),
  address: text("address"),
  currentPhase: text("current_phase").notNull(),
  status: text("status").notNull(),
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
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true, description: true, clientName: true, address: true,
  currentPhase: true, status: true, coverImageUrl: true,
  buildingArea: true, totalFloorArea: true, buildingCoverage: true,
  floorAreaRatio: true, floors: true, basementFloors: true, aboveFloors: true,
  structureType: true, mainUse: true, specialNotes: true, createdBy: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ProjectMembers
export const projectMembers = sqliteTable("project_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).pick({
  projectId: true, userId: true, role: true,
});
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// Schedules
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  memo: text("memo"),
  location: text("location"),
  time: text("time"),
  attachments: text("attachments"),
  createdBy: text("created_by"),
});

export const insertScheduleSchema = createInsertSchema(schedules).pick({
  projectId: true, phase: true, title: true, date: true, category: true,
  memo: true, location: true, time: true, attachments: true, createdBy: true,
});
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

// DailyLogs
export const dailyLogs = sqliteTable("daily_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  date: text("date").notNull(),
  content: text("content").notNull(),
  weather: text("weather"),
  workers: integer("workers"),
  attachments: text("attachments"),
  createdBy: text("created_by"),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).pick({
  projectId: true, phase: true, date: true, content: true,
  weather: true, workers: true, attachments: true, createdBy: true,
});
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

// Files
export const files = sqliteTable("files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  version: text("version"),
  description: text("description"),
  createdBy: text("created_by"),
});

export const insertFileSchema = createInsertSchema(files).pick({
  projectId: true, phase: true, title: true, url: true, category: true,
  version: true, description: true, createdBy: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// Photos
export const photos = sqliteTable("photos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  description: text("description"),
  tags: text("tags"),
  takenAt: text("taken_at"),
  subCategory: text("sub_category"),
  createdBy: text("created_by"),
});

export const insertPhotoSchema = createInsertSchema(photos).pick({
  projectId: true, phase: true, imageUrl: true, thumbnailUrl: true,
  description: true, tags: true, takenAt: true, subCategory: true, createdBy: true,
});
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

// ClientRequests
export const clientRequests = sqliteTable("client_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  category: text("category").notNull(),
  assigneeId: text("assignee_id"),
  attachments: text("attachments"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  resolvedAt: text("resolved_at"),
});

export const insertClientRequestSchema = createInsertSchema(clientRequests).pick({
  projectId: true, phase: true, title: true, content: true,
  status: true, priority: true, category: true, assigneeId: true,
  attachments: true, createdBy: true,
});
export type InsertClientRequest = z.infer<typeof insertClientRequestSchema>;
export type ClientRequest = typeof clientRequests.$inferSelect;

// Comments
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientRequestId: text("client_request_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  clientRequestId: true, authorId: true, content: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Design Changes
export const designChanges = sqliteTable("design_changes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reason: text("reason"),
  impactArea: text("impact_area"),
  status: text("status").notNull(),
  requestedBy: text("requested_by"),
  approvedBy: text("approved_by"),
  relatedFileId: text("related_file_id"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const insertDesignChangeSchema = createInsertSchema(designChanges).pick({
  projectId: true, title: true, description: true, reason: true,
  impactArea: true, status: true, requestedBy: true, approvedBy: true, relatedFileId: true,
});
export type InsertDesignChange = z.infer<typeof insertDesignChangeSchema>;
export type DesignChange = typeof designChanges.$inferSelect;

// Design Checks
export const designChecks = sqliteTable("design_checks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull().default("DESIGN"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  isCompleted: integer("is_completed").notNull().default(0),
  completedBy: text("completed_by"),
  completedAt: text("completed_at"),
  memo: text("memo"),
  linkedToConstruction: integer("linked_to_construction").notNull().default(0),
  attachments: text("attachments"),
});

export const insertDesignCheckSchema = createInsertSchema(designChecks).pick({
  projectId: true, phase: true, category: true, title: true,
  isCompleted: true, completedBy: true, memo: true, linkedToConstruction: true, attachments: true,
});
export type InsertDesignCheck = z.infer<typeof insertDesignCheckSchema>;
export type DesignCheck = typeof designChecks.$inferSelect;

// Construction Tasks
export const constructionTasks = sqliteTable("construction_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  status: text("status").notNull(),
  progress: integer("progress").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  assignee: text("assignee"),
  sortOrder: integer("sort_order").notNull().default(0),
  memo: text("memo"),
  checklist: text("checklist"),
  createdBy: text("created_by"),
});

export const insertConstructionTaskSchema = createInsertSchema(constructionTasks).pick({
  projectId: true, title: true, description: true, category: true,
  status: true, progress: true, startDate: true, endDate: true,
  assignee: true, sortOrder: true, memo: true, checklist: true, createdBy: true,
});
export type InsertConstructionTask = z.infer<typeof insertConstructionTaskSchema>;
export type ConstructionTask = typeof constructionTasks.$inferSelect;

// Inspections
export const inspections = sqliteTable("inspections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  result: text("result").notNull(),
  inspector: text("inspector"),
  findings: text("findings"),
  createdBy: text("created_by"),
});

export const insertInspectionSchema = createInsertSchema(inspections).pick({
  projectId: true, title: true, category: true, scheduledDate: true,
  completedDate: true, result: true, inspector: true, findings: true, createdBy: true,
});
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// Defects
export const defects = sqliteTable("defects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  reportedBy: text("reported_by"),
  assignee: text("assignee"),
  reportedAt: text("reported_at").$defaultFn(() => new Date().toISOString()),
  resolvedAt: text("resolved_at"),
});

export const insertDefectSchema = createInsertSchema(defects).pick({
  projectId: true, title: true, description: true, location: true,
  severity: true, status: true, reportedBy: true, assignee: true,
});
export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;
