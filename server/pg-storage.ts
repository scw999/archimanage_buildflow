import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, projectMembers, schedules, dailyLogs,
  files, photos, clientRequests, comments,
  designChanges, designChecks, constructionTasks, inspections, defects,
} from "@shared/schema";
import type {
  User, InsertUser,
  Project, InsertProject,
  ProjectMember, InsertProjectMember,
  Schedule, InsertSchedule,
  DailyLog, InsertDailyLog,
  File, InsertFile,
  Photo, InsertPhoto,
  ClientRequest, InsertClientRequest,
  Comment, InsertComment,
  DesignChange, InsertDesignChange,
  DesignCheck, InsertDesignCheck,
  ConstructionTask, InsertConstructionTask,
  Inspection, InsertInspection,
  Defect, InsertDefect,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class PgStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(data: InsertUser): Promise<User> {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [row] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return row;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [row] = await db.select().from(projects).where(eq(projects.id, id));
    return row;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [row] = await db.insert(projects).values(data).returning();
    return row;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return row;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // ProjectMembers
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const members = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
    if (members.length === 0) return [];
    const projectIds = members.map((m) => m.projectId);
    const allProjects = await db.select().from(projects);
    return allProjects.filter((p) => projectIds.includes(p.id));
  }

  async addProjectMember(data: InsertProjectMember): Promise<ProjectMember> {
    const [row] = await db.insert(projectMembers).values(data).returning();
    return row;
  }

  async removeProjectMember(id: string): Promise<boolean> {
    const result = await db.delete(projectMembers).where(eq(projectMembers.id, id)).returning();
    return result.length > 0;
  }

  // Schedules
  async getSchedulesByProject(projectId: string): Promise<Schedule[]> {
    return db.select().from(schedules).where(eq(schedules.projectId, projectId));
  }

  async createSchedule(data: InsertSchedule): Promise<Schedule> {
    const [row] = await db.insert(schedules).values(data).returning();
    return row;
  }

  async updateSchedule(id: string, data: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const [row] = await db.update(schedules).set(data).where(eq(schedules.id, id)).returning();
    return row;
  }

  // DailyLogs
  async getDailyLogsByProject(projectId: string): Promise<DailyLog[]> {
    return db.select().from(dailyLogs).where(eq(dailyLogs.projectId, projectId));
  }

  async createDailyLog(data: InsertDailyLog): Promise<DailyLog> {
    const [row] = await db.insert(dailyLogs).values(data).returning();
    return row;
  }

  async updateDailyLog(id: string, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined> {
    const [row] = await db.update(dailyLogs).set(data).where(eq(dailyLogs.id, id)).returning();
    return row;
  }

  // Files
  async getFilesByProject(projectId: string): Promise<File[]> {
    return db.select().from(files).where(eq(files.projectId, projectId));
  }

  async createFile(data: InsertFile): Promise<File> {
    const [row] = await db.insert(files).values(data).returning();
    return row;
  }

  // Photos
  async getPhotosByProject(projectId: string): Promise<Photo[]> {
    return db.select().from(photos).where(eq(photos.projectId, projectId));
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const [row] = await db.select().from(photos).where(eq(photos.id, id));
    return row;
  }

  async createPhoto(data: InsertPhoto): Promise<Photo> {
    const [row] = await db.insert(photos).values(data).returning();
    return row;
  }

  async updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const [row] = await db.update(photos).set(data).where(eq(photos.id, id)).returning();
    return row;
  }

  async deletePhoto(id: string): Promise<boolean> {
    const result = await db.delete(photos).where(eq(photos.id, id)).returning();
    return result.length > 0;
  }

  // ClientRequests
  async getRequestsByProject(projectId: string): Promise<ClientRequest[]> {
    return db.select().from(clientRequests).where(eq(clientRequests.projectId, projectId));
  }

  async getRequest(id: string): Promise<ClientRequest | undefined> {
    const [row] = await db.select().from(clientRequests).where(eq(clientRequests.id, id));
    return row;
  }

  async createRequest(data: InsertClientRequest): Promise<ClientRequest> {
    const [row] = await db.insert(clientRequests).values(data).returning();
    return row;
  }

  async updateRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined> {
    const [row] = await db.update(clientRequests).set(data).where(eq(clientRequests.id, id)).returning();
    return row;
  }

  // Comments
  async getCommentsByRequest(requestId: string): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.clientRequestId, requestId));
  }

  async createComment(data: InsertComment): Promise<Comment> {
    const [row] = await db.insert(comments).values(data).returning();
    return row;
  }

  // Design Changes
  async getDesignChangesByProject(projectId: string): Promise<DesignChange[]> {
    return db.select().from(designChanges).where(eq(designChanges.projectId, projectId));
  }

  async createDesignChange(data: InsertDesignChange): Promise<DesignChange> {
    const [row] = await db.insert(designChanges).values(data).returning();
    return row;
  }

  async updateDesignChange(id: string, data: Partial<InsertDesignChange>): Promise<DesignChange | undefined> {
    const [row] = await db.update(designChanges).set(data).where(eq(designChanges.id, id)).returning();
    return row;
  }

  // Design Checks
  async getDesignChecksByProject(projectId: string): Promise<DesignCheck[]> {
    return db.select().from(designChecks).where(eq(designChecks.projectId, projectId));
  }

  async createDesignCheck(data: InsertDesignCheck): Promise<DesignCheck> {
    const [row] = await db.insert(designChecks).values(data).returning();
    return row;
  }

  async updateDesignCheck(id: string, data: Partial<InsertDesignCheck>): Promise<DesignCheck | undefined> {
    const [row] = await db.update(designChecks).set(data).where(eq(designChecks.id, id)).returning();
    return row;
  }

  async deleteDesignCheck(id: string): Promise<boolean> {
    const result = await db.delete(designChecks).where(eq(designChecks.id, id));
    return (result as any).rowCount > 0;
  }

  // Construction Tasks
  async getConstructionTasksByProject(projectId: string): Promise<ConstructionTask[]> {
    return db.select().from(constructionTasks).where(eq(constructionTasks.projectId, projectId));
  }

  async createConstructionTask(data: InsertConstructionTask): Promise<ConstructionTask> {
    const [row] = await db.insert(constructionTasks).values(data).returning();
    return row;
  }

  async updateConstructionTask(id: string, data: Partial<InsertConstructionTask>): Promise<ConstructionTask | undefined> {
    const [row] = await db.update(constructionTasks).set(data).where(eq(constructionTasks.id, id)).returning();
    return row;
  }

  async deleteConstructionTask(id: string): Promise<boolean> {
    const result = await db.delete(constructionTasks).where(eq(constructionTasks.id, id)).returning();
    return result.length > 0;
  }

  // Inspections
  async getInspectionsByProject(projectId: string): Promise<Inspection[]> {
    return db.select().from(inspections).where(eq(inspections.projectId, projectId));
  }

  async createInspection(data: InsertInspection): Promise<Inspection> {
    const [row] = await db.insert(inspections).values(data).returning();
    return row;
  }

  async updateInspection(id: string, data: Partial<InsertInspection>): Promise<Inspection | undefined> {
    const [row] = await db.update(inspections).set(data).where(eq(inspections.id, id)).returning();
    return row;
  }

  async deleteInspection(id: string): Promise<boolean> {
    const result = await db.delete(inspections).where(eq(inspections.id, id));
    return (result as any).rowCount > 0;
  }

  // Defects
  async getDefectsByProject(projectId: string): Promise<Defect[]> {
    return db.select().from(defects).where(eq(defects.projectId, projectId));
  }

  async createDefect(data: InsertDefect): Promise<Defect> {
    const [row] = await db.insert(defects).values(data).returning();
    return row;
  }

  async updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect | undefined> {
    const [row] = await db.update(defects).set(data).where(eq(defects.id, id)).returning();
    return row;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await db.delete(schedules).where(eq(schedules.id, id)).returning();
    return result.length > 0;
  }

  async deleteDailyLog(id: string): Promise<boolean> {
    const result = await db.delete(dailyLogs).where(eq(dailyLogs.id, id)).returning();
    return result.length > 0;
  }

  async updateFile(id: string, data: Partial<InsertFile>): Promise<File | undefined> {
    const [row] = await db.update(files).set(data).where(eq(files.id, id)).returning();
    return row;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id)).returning();
    return result.length > 0;
  }

  async deleteDesignChange(id: string): Promise<boolean> {
    const result = await db.delete(designChanges).where(eq(designChanges.id, id)).returning();
    return result.length > 0;
  }

  async deleteDefect(id: string): Promise<boolean> {
    const result = await db.delete(defects).where(eq(defects.id, id)).returning();
    return result.length > 0;
  }

  async deleteRequest(id: string): Promise<boolean> {
    const result = await db.delete(clientRequests).where(eq(clientRequests.id, id)).returning();
    return result.length > 0;
  }

  async removeUrlFromAllAttachments(imageUrl: string): Promise<void> {
    const tables = [schedules, dailyLogs, designChanges, designChecks, clientRequests, inspections, defects] as const;
    for (const tbl of tables) {
      const rows = await db.select().from(tbl);
      for (const row of rows) {
        const att = (row as any).attachments;
        if (!att) continue;
        try {
          const urls: string[] = JSON.parse(att);
          if (!Array.isArray(urls) || !urls.includes(imageUrl)) continue;
          const filtered = urls.filter((u: string) => u !== imageUrl);
          await db.update(tbl as any).set({ attachments: filtered.length ? JSON.stringify(filtered) : null } as any)
            .where(eq((tbl as any).id, (row as any).id));
        } catch { /* ignore */ }
      }
    }
  }

  async getPhotoByUrl(url: string): Promise<Photo | undefined> {
    const [row] = await db.select().from(photos).where(eq(photos.imageUrl, url));
    return row;
  }

  async isUrlReferencedInAttachments(url: string): Promise<boolean> {
    const tables = [schedules, dailyLogs, designChanges, designChecks, clientRequests, inspections, defects] as const;
    for (const tbl of tables) {
      const rows = await db.select().from(tbl);
      for (const row of rows) {
        const att = (row as any).attachments;
        if (!att) continue;
        try {
          const urls: string[] = JSON.parse(att);
          if (Array.isArray(urls) && urls.includes(url)) return true;
        } catch { /* ignore */ }
      }
    }
    return false;
  }
}
