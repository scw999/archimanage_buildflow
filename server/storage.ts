import {
  type User, type InsertUser,
  type Project, type InsertProject,
  type ProjectMember, type InsertProjectMember,
  type Schedule, type InsertSchedule,
  type DailyLog, type InsertDailyLog,
  type File, type InsertFile,
  type Photo, type InsertPhoto,
  type ClientRequest, type InsertClientRequest,
  type Comment, type InsertComment,
  type DesignChange, type InsertDesignChange,
  type DesignCheck, type InsertDesignCheck,
  type ConstructionTask, type InsertConstructionTask,
  type Inspection, type InsertInspection,
  type Defect, type InsertDefect,
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // ProjectMembers
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  removeProjectMember(id: string): Promise<boolean>;

  // Schedules
  getSchedulesByProject(projectId: string): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;

  // DailyLogs
  getDailyLogsByProject(projectId: string): Promise<DailyLog[]>;
  createDailyLog(log: InsertDailyLog): Promise<DailyLog>;

  // Files
  getFilesByProject(projectId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;

  // Photos
  getPhotosByProject(projectId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined>;
  deletePhoto(id: string): Promise<boolean>;

  // ClientRequests
  getRequestsByProject(projectId: string): Promise<ClientRequest[]>;
  getRequest(id: string): Promise<ClientRequest | undefined>;
  createRequest(request: InsertClientRequest): Promise<ClientRequest>;
  updateRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined>;

  // Comments
  getCommentsByRequest(requestId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  // Design Changes
  getDesignChangesByProject(projectId: string): Promise<DesignChange[]>;
  createDesignChange(dc: InsertDesignChange): Promise<DesignChange>;
  updateDesignChange(id: string, data: Partial<InsertDesignChange>): Promise<DesignChange | undefined>;

  // Design Checks
  getDesignChecksByProject(projectId: string): Promise<DesignCheck[]>;
  createDesignCheck(check: InsertDesignCheck): Promise<DesignCheck>;
  updateDesignCheck(id: string, data: Partial<InsertDesignCheck>): Promise<DesignCheck | undefined>;

  // Construction Tasks
  getConstructionTasksByProject(projectId: string): Promise<ConstructionTask[]>;
  createConstructionTask(task: InsertConstructionTask): Promise<ConstructionTask>;
  updateConstructionTask(id: string, data: Partial<InsertConstructionTask>): Promise<ConstructionTask | undefined>;
  deleteConstructionTask(id: string): Promise<boolean>;

  // Inspections
  getInspectionsByProject(projectId: string): Promise<Inspection[]>;
  createInspection(insp: InsertInspection): Promise<Inspection>;
  updateInspection(id: string, data: Partial<InsertInspection>): Promise<Inspection | undefined>;

  // Defects
  getDefectsByProject(projectId: string): Promise<Defect[]>;
  createDefect(defect: InsertDefect): Promise<Defect>;
  updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private projectMembers: Map<string, ProjectMember>;
  private schedules: Map<string, Schedule>;
  private dailyLogs: Map<string, DailyLog>;
  private files: Map<string, File>;
  private photos: Map<string, Photo>;
  private clientRequests: Map<string, ClientRequest>;
  private comments: Map<string, Comment>;
  private designChanges: Map<string, DesignChange>;
  private designChecks: Map<string, DesignCheck>;
  private constructionTasks: Map<string, ConstructionTask>;
  private inspections: Map<string, Inspection>;
  private defects: Map<string, Defect>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.projectMembers = new Map();
    this.schedules = new Map();
    this.dailyLogs = new Map();
    this.files = new Map();
    this.photos = new Map();
    this.clientRequests = new Map();
    this.comments = new Map();
    this.designChanges = new Map();
    this.designChecks = new Map();
    this.constructionTasks = new Map();
    this.inspections = new Map();
    this.defects = new Map();

    this.seed();
  }

  private seed() {
    // Users
    const adminId = "user-admin-1";
    const clientId = "user-client-1";

    this.users.set(adminId, {
      id: adminId,
      email: "admin@buildflow.com",
      password: bcrypt.hashSync("admin123", 10),
      name: "김건축",
      role: "PM",
      avatarUrl: null,
      createdAt: new Date(),
    });

    this.users.set(clientId, {
      id: clientId,
      email: "client@buildflow.com",
      password: bcrypt.hashSync("client123", 10),
      name: "이건축주",
      role: "CLIENT",
      avatarUrl: null,
      createdAt: new Date(),
    });

    // Projects
    const proj1Id = "proj-1";
    const proj2Id = "proj-2";

    this.projects.set(proj1Id, {
      id: proj1Id,
      name: "강남 주택 신축",
      description: "강남구 삼성동 단독주택 신축 프로젝트. 지하 1층, 지상 3층 규모의 고급 주택으로 설계 중이며, 자연 채광과 에너지 효율을 극대화한 설계가 특징입니다.",
      clientName: "이건축주",
      address: "서울시 강남구 삼성동 123-45",
      currentPhase: "CONSTRUCTION",
      status: "ACTIVE",
      coverImageUrl: null,
      buildingArea: "198.5",
      totalFloorArea: "595.2",
      buildingCoverage: "59.8",
      floorAreaRatio: "179.4",
      floors: "지하1층 / 지상3층",
      structureType: "철근콘크리트조",
      mainUse: "단독주택",
      specialNotes: "자연 채광 극대화 설계, 에너지 효율 1등급 목표",
      createdBy: adminId,
      createdAt: new Date("2024-01-15"),
    });

    this.projects.set(proj2Id, {
      id: proj2Id,
      name: "판교 카페 인테리어",
      description: "판교 테크노밸리 내 카페 인테리어 리모델링 프로젝트. 모던 인더스트리얼 컨셉으로 기존 공간을 재구성합니다.",
      clientName: "박카페",
      address: "경기도 성남시 분당구 판교역로 235",
      currentPhase: "DESIGN",
      status: "ACTIVE",
      coverImageUrl: null,
      buildingArea: "85.0",
      totalFloorArea: "85.0",
      buildingCoverage: null,
      floorAreaRatio: null,
      floors: "지상1층",
      structureType: "철골조",
      mainUse: "근린생활시설(카페)",
      specialNotes: "모던 인더스트리얼 컨셉, 좌석 40석 규모",
      createdBy: adminId,
      createdAt: new Date("2024-06-01"),
    });

    // Project Members
    this.projectMembers.set("pm-1", {
      id: "pm-1",
      projectId: proj1Id,
      userId: adminId,
      role: "PM",
    });
    this.projectMembers.set("pm-2", {
      id: "pm-2",
      projectId: proj1Id,
      userId: clientId,
      role: "CLIENT",
    });
    this.projectMembers.set("pm-3", {
      id: "pm-3",
      projectId: proj2Id,
      userId: adminId,
      role: "PM",
    });

    // Schedules for project 1
    const scheduleData: Array<Omit<Schedule, "id">> = [
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "기초 공사 착공", date: "2024-09-01", category: "CONSTRUCTION", memo: "기초 콘크리트 타설 시작", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "골조 공사 완료 점검", date: "2024-10-15", category: "INSPECTION", memo: "구조 안전 검사", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "건축주 미팅", date: "2024-11-01", category: "MEETING", memo: "내부 마감재 선정 회의", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "전기 배선 완료 기한", date: "2024-11-20", category: "DEADLINE", memo: null, createdBy: adminId },
      { projectId: proj2Id, phase: "DESIGN", title: "초기 디자인 컨셉 발표", date: "2024-07-01", category: "MEETING", memo: "건축주 참석 필수", createdBy: adminId },
      { projectId: proj2Id, phase: "DESIGN", title: "실시 설계 제출 마감", date: "2024-08-15", category: "DEADLINE", memo: null, createdBy: adminId },
    ];

    scheduleData.forEach((s, i) => {
      const id = `sched-${i + 1}`;
      this.schedules.set(id, { id, ...s });
    });

    // Daily Logs for project 1
    const logData: Array<Omit<DailyLog, "id">> = [
      { projectId: proj1Id, phase: "CONSTRUCTION", date: "2024-09-01", content: "기초 콘크리트 타설 작업 진행. 레미콘 15대 투입. 오전 중 타설 완료.", weather: "맑음", workers: 12, createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", date: "2024-09-02", content: "기초 양생 작업 및 거푸집 해체. 배수 시스템 설치 시작.", weather: "흐림", workers: 8, createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", date: "2024-09-03", content: "1층 골조 철근 배근 작업 시작. 자재 반입 완료.", weather: "맑음", workers: 15, createdBy: adminId },
    ];

    logData.forEach((l, i) => {
      const id = `log-${i + 1}`;
      this.dailyLogs.set(id, { id, ...l });
    });

    // Files
    const fileData: Array<Omit<File, "id">> = [
      { projectId: proj1Id, phase: "DESIGN", title: "건축 설계도면 v3", url: "https://drive.google.com/file/d/example1", category: "DRAWING", version: "v3.0", description: "최종 건축 설계도면", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "구조 계산서", url: "https://drive.google.com/file/d/example2", category: "STRUCTURAL", version: "v1.2", description: "구조 안전 계산서", createdBy: adminId },
      { projectId: proj1Id, phase: "DESIGN", title: "인테리어 시안", url: "https://drive.google.com/file/d/example3", category: "INTERIOR", version: "v2.0", description: "1층~3층 인테리어 디자인 시안", createdBy: adminId },
      { projectId: proj2Id, phase: "DESIGN", title: "카페 평면도", url: "https://drive.google.com/file/d/example4", category: "DRAWING", version: "v1.0", description: "카페 리모델링 평면 설계", createdBy: adminId },
    ];

    fileData.forEach((f, i) => {
      const id = `file-${i + 1}`;
      this.files.set(id, { id, ...f });
    });

    // Photos
    const photoData: Array<Omit<Photo, "id">> = [
      { projectId: proj1Id, phase: "CONSTRUCTION", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800", thumbnailUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200", description: "기초 공사 현장", tags: "기초,공사,현장", takenAt: "2024-09-01", subCategory: "기초공사", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800", thumbnailUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200", description: "골조 공사 진행 중", tags: "골조,철근", takenAt: "2024-09-15", subCategory: "골조공사", createdBy: adminId },
      { projectId: proj1Id, phase: "CONSTRUCTION", imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800", thumbnailUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200", description: "현장 전경", tags: "전경,외부", takenAt: "2024-10-01", subCategory: "전경", createdBy: adminId },
      { projectId: proj2Id, phase: "DESIGN", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800", thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200", description: "기존 카페 공간", tags: "기존,현황", takenAt: "2024-06-15", subCategory: "현황사진", createdBy: adminId },
    ];

    photoData.forEach((p, i) => {
      const id = `photo-${i + 1}`;
      this.photos.set(id, { id, ...p });
    });

    // Client Requests
    const requestData: Array<Omit<ClientRequest, "id">> = [
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "1층 바닥재 변경 요청", content: "기존 포세린 타일에서 원목 마루로 변경을 원합니다. 거실과 주방 영역에 해당합니다.", status: "IN_PROGRESS", priority: "HIGH", category: "MATERIAL_CHANGE", assigneeId: adminId, createdBy: clientId, createdAt: new Date("2024-10-20"), resolvedAt: null },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "2층 발코니 확장", content: "2층 안방 발코니를 확장하여 드레스룸으로 활용하고 싶습니다.", status: "REVIEWING", priority: "NORMAL", category: "DESIGN_CHANGE", assigneeId: adminId, createdBy: clientId, createdAt: new Date("2024-10-25"), resolvedAt: null },
      { projectId: proj1Id, phase: "CONSTRUCTION", title: "옥상 정원 추가", content: "옥상에 간단한 정원 공간을 추가로 설치해주세요.", status: "NEW", priority: "LOW", category: "ADDITIONAL_WORK", assigneeId: null, createdBy: clientId, createdAt: new Date("2024-11-01"), resolvedAt: null },
    ];

    requestData.forEach((r, i) => {
      const id = `req-${i + 1}`;
      this.clientRequests.set(id, { id, ...r });
    });

    // Comments
    const commentData: Array<Omit<Comment, "id">> = [
      { clientRequestId: "req-1", authorId: adminId, content: "바닥재 변경 견적을 확인 중입니다. 원목 마루의 경우 추가 비용이 발생할 수 있습니다.", createdAt: new Date("2024-10-21") },
      { clientRequestId: "req-1", authorId: clientId, content: "추가 비용 범위를 알려주시면 검토하겠습니다.", createdAt: new Date("2024-10-22") },
      { clientRequestId: "req-2", authorId: adminId, content: "발코니 확장 관련 구조 검토가 필요합니다. 2~3일 내 결과를 공유하겠습니다.", createdAt: new Date("2024-10-26") },
    ];

    commentData.forEach((c, i) => {
      const id = `comment-${i + 1}`;
      this.comments.set(id, { id, ...c });
    });

    // Design Changes for proj-1
    const designChangeData: Array<Omit<DesignChange, "id">> = [
      { projectId: proj1Id, title: "외벽 마감재 변경 (타일→적벽돌)", description: "외벽 마감재를 기존 타일에서 적벽돌로 변경. 건축주 요청에 따라 따뜻한 느낌의 외관으로 변경합니다.", reason: "건축주 선호도 반영 및 유지보수 용이성", impactArea: "외부 마감", status: "APPROVED", requestedBy: clientId, approvedBy: adminId, relatedFileId: "file-1", createdAt: new Date("2024-08-15") },
      { projectId: proj1Id, title: "2층 창호 사이즈 변경", description: "2층 거실 창호를 기존 1800x2100에서 2400x2400으로 확대. 채광 극대화를 위한 변경.", reason: "채광 극대화 및 조망권 확보", impactArea: "2층 거실", status: "REVIEWING", requestedBy: clientId, approvedBy: null, relatedFileId: null, createdAt: new Date("2024-10-01") },
    ];

    designChangeData.forEach((dc, i) => {
      const id = `dc-${i + 1}`;
      this.designChanges.set(id, { id, ...dc });
    });

    // Design Checks for proj-1 (CONSTRUCTION phase, design checks from earlier)
    const designCheckDataProj1: Array<Omit<DesignCheck, "id">> = [
      { projectId: proj1Id, category: "ARCHITECTURE", title: "건축 설계도면 최종 확인", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-01"), memo: "최종 설계도면 v3 확인 완료" },
      { projectId: proj1Id, category: "STRUCTURE", title: "구조 계산서 검토", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-05"), memo: "구조 안전성 검토 통과" },
      { projectId: proj1Id, category: "MEP", title: "MEP 설계 조율", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-10"), memo: "기계/전기 설계 협의 완료" },
      { projectId: proj1Id, category: "INTERIOR", title: "인테리어 시안 확정", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-15"), memo: "건축주 최종 컨펌" },
      { projectId: proj1Id, category: "LANDSCAPE", title: "조경 설계 확인", isCompleted: 0, completedBy: null, completedAt: null, memo: null },
      { projectId: proj1Id, category: "PERMIT_DOC", title: "인허가 서류 제출", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-08-01"), memo: "건축허가 승인 완료" },
    ];

    designCheckDataProj1.forEach((dc, i) => {
      const id = `dchk-1-${i + 1}`;
      this.designChecks.set(id, { id, ...dc });
    });

    // Design Checks for proj-2 (DESIGN phase)
    const designCheckDataProj2: Array<Omit<DesignCheck, "id">> = [
      { projectId: proj2Id, category: "ARCHITECTURE", title: "카페 평면 레이아웃 확정", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-20"), memo: "좌석 배치 및 동선 확정" },
      { projectId: proj2Id, category: "STRUCTURE", title: "구조 안전 검토", isCompleted: 0, completedBy: null, completedAt: null, memo: null },
      { projectId: proj2Id, category: "MEP", title: "기계/전기 설계", isCompleted: 0, completedBy: null, completedAt: null, memo: null },
      { projectId: proj2Id, category: "INTERIOR", title: "인테리어 컨셉 확정", isCompleted: 1, completedBy: adminId, completedAt: new Date("2024-07-25"), memo: "모던 인더스트리얼 컨셉 확정" },
    ];

    designCheckDataProj2.forEach((dc, i) => {
      const id = `dchk-2-${i + 1}`;
      this.designChecks.set(id, { id, ...dc });
    });

    // Construction Tasks for proj-1
    const constructionTaskData: Array<Omit<ConstructionTask, "id">> = [
      { projectId: proj1Id, title: "터파기 및 기초공사", description: "부지 터파기 및 기초 콘크리트 타설", category: "기초", status: "COMPLETED", progress: 100, startDate: "2024-08-15", endDate: "2024-09-10", assignee: "대한건설", sortOrder: 1, createdBy: adminId },
      { projectId: proj1Id, title: "골조 공사 (1층~3층)", description: "철근콘크리트 골조 공사", category: "골조", status: "COMPLETED", progress: 100, startDate: "2024-09-11", endDate: "2024-10-20", assignee: "대한건설", sortOrder: 2, createdBy: adminId },
      { projectId: proj1Id, title: "방수 공사", description: "지하층 및 옥상 방수 처리", category: "방수", status: "IN_PROGRESS", progress: 70, startDate: "2024-10-21", endDate: "2024-11-15", assignee: "방수전문", sortOrder: 3, createdBy: adminId },
      { projectId: proj1Id, title: "외벽 마감", description: "적벽돌 외벽 마감 공사", category: "마감", status: "IN_PROGRESS", progress: 40, startDate: "2024-11-01", endDate: "2024-12-15", assignee: "마감건설", sortOrder: 4, createdBy: adminId },
      { projectId: proj1Id, title: "내부 전기 배선", description: "각 층 전기 배선 및 분전반 설치", category: "전기", status: "IN_PROGRESS", progress: 60, startDate: "2024-10-25", endDate: "2024-11-30", assignee: "한빛전기", sortOrder: 5, createdBy: adminId },
      { projectId: proj1Id, title: "배관 설비", description: "급수/배수/난방 배관 설치", category: "설비", status: "IN_PROGRESS", progress: 50, startDate: "2024-10-25", endDate: "2024-12-01", assignee: "수도설비", sortOrder: 6, createdBy: adminId },
      { projectId: proj1Id, title: "내부 마감 (도배, 타일)", description: "내벽 도배 및 바닥 타일 시공", category: "마감", status: "NOT_STARTED", progress: 0, startDate: "2024-12-01", endDate: "2025-01-15", assignee: "인테리어공방", sortOrder: 7, createdBy: adminId },
      { projectId: proj1Id, title: "조경 공사", description: "정원 조경 및 외부 식재", category: "조경", status: "NOT_STARTED", progress: 0, startDate: "2025-01-16", endDate: "2025-02-15", assignee: "그린조경", sortOrder: 8, createdBy: adminId },
      { projectId: proj1Id, title: "외부 정리 및 청소", description: "공사 완료 후 외부 정리 및 청소", category: "마감", status: "NOT_STARTED", progress: 0, startDate: "2025-02-16", endDate: "2025-02-28", assignee: "대한건설", sortOrder: 9, createdBy: adminId },
    ];

    constructionTaskData.forEach((ct, i) => {
      const id = `ctask-${i + 1}`;
      this.constructionTasks.set(id, { id, ...ct });
    });

    // Inspections for proj-1
    const inspectionData: Array<Omit<Inspection, "id">> = [
      { projectId: proj1Id, title: "기초 구조 검사", category: "구조검사", scheduledDate: "2024-09-05", completedDate: "2024-09-05", result: "PASS", inspector: "한국건축안전원 김검사", findings: "기초 구조 안전성 확인. 콘크리트 강도 기준 충족.", createdBy: adminId },
      { projectId: proj1Id, title: "골조 안전 검사", category: "구조검사", scheduledDate: "2024-10-15", completedDate: "2024-10-15", result: "PASS", inspector: "한국건축안전원 박검사", findings: "골조 구조 안전 확인. 철근 배근 상태 양호.", createdBy: adminId },
      { projectId: proj1Id, title: "방수 검사", category: "방수검사", scheduledDate: "2024-12-01", completedDate: null, result: "PENDING", inspector: null, findings: null, createdBy: adminId },
      { projectId: proj1Id, title: "전기 안전 검사", category: "전기검사", scheduledDate: "2024-12-15", completedDate: null, result: "PENDING", inspector: null, findings: null, createdBy: adminId },
    ];

    inspectionData.forEach((insp, i) => {
      const id = `insp-${i + 1}`;
      this.inspections.set(id, { id, ...insp });
    });

    // Defects for proj-1
    const defectData: Array<Omit<Defect, "id">> = [
      { projectId: proj1Id, title: "1층 거실 벽체 균열", description: "1층 거실 남측 벽면에 미세 균열 발견. 구조적 문제는 아니나 미관상 보수 필요.", location: "1층 거실 남측 벽면", severity: "MINOR", status: "IN_REPAIR", reportedBy: adminId, assignee: "대한건설", reportedAt: new Date("2024-10-20"), resolvedAt: null },
      { projectId: proj1Id, title: "지하 방수층 누수", description: "지하1층 기계실 벽면에서 미세 누수 발견. 방수층 보강 필요.", location: "지하1층 기계실", severity: "MAJOR", status: "REPAIRED", reportedBy: adminId, assignee: "방수전문", reportedAt: new Date("2024-10-10"), resolvedAt: new Date("2024-10-18") },
    ];

    defectData.forEach((d, i) => {
      const id = `defect-${i + 1}`;
      this.defects.set(id, { id, ...d });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { id, createdAt: new Date(), avatarUrl: null, ...insertUser };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { id, createdAt: new Date(), coverImageUrl: null, description: null, clientName: null, address: null, createdBy: null, buildingArea: null, totalFloorArea: null, buildingCoverage: null, floorAreaRatio: null, floors: null, structureType: null, mainUse: null, specialNotes: null, ...insertProject };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...data };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // ProjectMembers
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return Array.from(this.projectMembers.values()).filter((m) => m.projectId === projectId);
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const memberEntries = Array.from(this.projectMembers.values()).filter((m) => m.userId === userId);
    const projectIds = memberEntries.map((m) => m.projectId);
    return Array.from(this.projects.values()).filter((p) => projectIds.includes(p.id));
  }

  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const id = randomUUID();
    const pm: ProjectMember = { id, ...member };
    this.projectMembers.set(id, pm);
    return pm;
  }

  async removeProjectMember(id: string): Promise<boolean> {
    return this.projectMembers.delete(id);
  }

  // Schedules
  async getSchedulesByProject(projectId: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter((s) => s.projectId === projectId);
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = randomUUID();
    const schedule: Schedule = { id, memo: null, location: null, time: null, createdBy: null, ...insertSchedule };
    this.schedules.set(id, schedule);
    return schedule;
  }

  // DailyLogs
  async getDailyLogsByProject(projectId: string): Promise<DailyLog[]> {
    return Array.from(this.dailyLogs.values()).filter((l) => l.projectId === projectId);
  }

  async createDailyLog(insertLog: InsertDailyLog): Promise<DailyLog> {
    const id = randomUUID();
    const log: DailyLog = { id, weather: null, workers: null, createdBy: null, ...insertLog };
    this.dailyLogs.set(id, log);
    return log;
  }

  // Files
  async getFilesByProject(projectId: string): Promise<File[]> {
    return Array.from(this.files.values()).filter((f) => f.projectId === projectId);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = { id, version: null, description: null, createdBy: null, ...insertFile };
    this.files.set(id, file);
    return file;
  }

  // Photos
  async getPhotosByProject(projectId: string): Promise<Photo[]> {
    return Array.from(this.photos.values()).filter((p) => p.projectId === projectId);
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    return this.photos.get(id);
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = randomUUID();
    const photo: Photo = { id, thumbnailUrl: null, description: null, tags: null, takenAt: null, subCategory: null, createdBy: null, ...insertPhoto };
    this.photos.set(id, photo);
    return photo;
  }

  async updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    const updated = { ...photo, ...data };
    this.photos.set(id, updated);
    return updated;
  }

  async deletePhoto(id: string): Promise<boolean> {
    return this.photos.delete(id);
  }

  // ClientRequests
  async getRequestsByProject(projectId: string): Promise<ClientRequest[]> {
    return Array.from(this.clientRequests.values()).filter((r) => r.projectId === projectId);
  }

  async getRequest(id: string): Promise<ClientRequest | undefined> {
    return this.clientRequests.get(id);
  }

  async createRequest(insertRequest: InsertClientRequest): Promise<ClientRequest> {
    const id = randomUUID();
    const request: ClientRequest = { id, createdAt: new Date(), resolvedAt: null, assigneeId: null, createdBy: null, ...insertRequest };
    this.clientRequests.set(id, request);
    return request;
  }

  async updateRequest(id: string, data: Partial<InsertClientRequest>): Promise<ClientRequest | undefined> {
    const request = this.clientRequests.get(id);
    if (!request) return undefined;
    const updated = { ...request, ...data };
    this.clientRequests.set(id, updated);
    return updated;
  }

  // Comments
  async getCommentsByRequest(requestId: string): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter((c) => c.clientRequestId === requestId);
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = { id, createdAt: new Date(), ...insertComment };
    this.comments.set(id, comment);
    return comment;
  }

  // Design Changes
  async getDesignChangesByProject(projectId: string): Promise<DesignChange[]> {
    return Array.from(this.designChanges.values()).filter((dc) => dc.projectId === projectId);
  }

  async createDesignChange(insertDc: InsertDesignChange): Promise<DesignChange> {
    const id = randomUUID();
    const dc: DesignChange = { id, createdAt: new Date(), reason: null, impactArea: null, requestedBy: null, approvedBy: null, relatedFileId: null, ...insertDc };
    this.designChanges.set(id, dc);
    return dc;
  }

  async updateDesignChange(id: string, data: Partial<InsertDesignChange>): Promise<DesignChange | undefined> {
    const dc = this.designChanges.get(id);
    if (!dc) return undefined;
    const updated = { ...dc, ...data };
    this.designChanges.set(id, updated);
    return updated;
  }

  // Design Checks
  async getDesignChecksByProject(projectId: string): Promise<DesignCheck[]> {
    return Array.from(this.designChecks.values()).filter((dc) => dc.projectId === projectId);
  }

  async createDesignCheck(insertCheck: InsertDesignCheck): Promise<DesignCheck> {
    const id = randomUUID();
    const check: DesignCheck = { id, isCompleted: 0, completedBy: null, completedAt: null, memo: null, ...insertCheck };
    this.designChecks.set(id, check);
    return check;
  }

  async updateDesignCheck(id: string, data: Partial<InsertDesignCheck>): Promise<DesignCheck | undefined> {
    const check = this.designChecks.get(id);
    if (!check) return undefined;
    const updated = { ...check, ...data };
    this.designChecks.set(id, updated);
    return updated;
  }

  // Construction Tasks
  async getConstructionTasksByProject(projectId: string): Promise<ConstructionTask[]> {
    return Array.from(this.constructionTasks.values()).filter((ct) => ct.projectId === projectId);
  }

  async createConstructionTask(insertTask: InsertConstructionTask): Promise<ConstructionTask> {
    const id = randomUUID();
    const task: ConstructionTask = { id, description: null, progress: 0, startDate: null, endDate: null, assignee: null, sortOrder: 0, createdBy: null, ...insertTask };
    this.constructionTasks.set(id, task);
    return task;
  }

  async updateConstructionTask(id: string, data: Partial<InsertConstructionTask>): Promise<ConstructionTask | undefined> {
    const task = this.constructionTasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...data };
    this.constructionTasks.set(id, updated);
    return updated;
  }

  async deleteConstructionTask(id: string): Promise<boolean> {
    return this.constructionTasks.delete(id);
  }

  // Inspections
  async getInspectionsByProject(projectId: string): Promise<Inspection[]> {
    return Array.from(this.inspections.values()).filter((i) => i.projectId === projectId);
  }

  async createInspection(insertInsp: InsertInspection): Promise<Inspection> {
    const id = randomUUID();
    const insp: Inspection = { id, scheduledDate: null, completedDate: null, inspector: null, findings: null, createdBy: null, ...insertInsp };
    this.inspections.set(id, insp);
    return insp;
  }

  async updateInspection(id: string, data: Partial<InsertInspection>): Promise<Inspection | undefined> {
    const insp = this.inspections.get(id);
    if (!insp) return undefined;
    const updated = { ...insp, ...data };
    this.inspections.set(id, updated);
    return updated;
  }

  // Defects
  async getDefectsByProject(projectId: string): Promise<Defect[]> {
    return Array.from(this.defects.values()).filter((d) => d.projectId === projectId);
  }

  async createDefect(insertDefect: InsertDefect): Promise<Defect> {
    const id = randomUUID();
    const defect: Defect = { id, reportedAt: new Date(), resolvedAt: null, reportedBy: null, assignee: null, ...insertDefect };
    this.defects.set(id, defect);
    return defect;
  }

  async updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect | undefined> {
    const defect = this.defects.get(id);
    if (!defect) return undefined;
    const updated = { ...defect, ...data };
    this.defects.set(id, updated);
    return updated;
  }
}

function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    const { PgStorage } = require("./pg-storage") as typeof import("./pg-storage");
    return new PgStorage();
  }
  return new MemStorage();
}

export const storage = createStorage();
