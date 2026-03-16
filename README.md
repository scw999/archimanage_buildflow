# BuildFlow - 건축 프로젝트 관리 시스템

건축사사무소를 위한 프로젝트 관리 웹앱입니다. 설계부터 포트폴리오 촬영까지 건축 프로젝트의 전 과정을 단계별로 관리합니다.

## 주요 기능

### 프로젝트 페이즈 관리
5단계 프로젝트 진행 관리:
- **설계** (DESIGN) - 도면, 설계 체크리스트, 설계변경 이력
- **인허가** (PERMIT) - 인허가 서류, 일정 관리
- **시공** (CONSTRUCTION) - 공정관리, 일일기록, 검수, 하자관리
- **준공** (COMPLETION) - 최종 검수, 하자 처리
- **포트폴리오** (PORTFOLIO) - 완공 사진 촬영 및 정리

### 핵심 기능
- **프로젝트 대시보드** - 전체 프로젝트 현황 요약
- **프로젝트 상세** - 일정, 일일기록, 파일, 사진, 건축주 요청, 설계변경, 공정관리, 검수, 하자 탭
- **파일 관리** - 구글 드라이브 링크 기반 도면/문서 관리 (카테고리: 도면, 구조, 인테리어, 문서, 기타)
- **사진 관리** - 시공 현장 사진 기록 (URL 기반)
- **건축주 요청사항** - 요청 등록/검토/진행/해결 상태 추적, 코멘트
- **설계변경 이력** - 변경 요청 → 검토 → 승인/반려 → 적용 워크플로우
- **설계 체크리스트** - 건축/구조/MEP/인테리어/조경/인허가서류 카테고리별 체크
- **공정관리** - 공정별 진행률, 담당업체, 일정 추적
- **검수 관리** - 검수 일정, 결과(합격/조건부합격/불합격/대기) 기록
- **하자 관리** - 하자 등록, 심각도, 보수 상태 추적
- **일일 작업일지** - 날짜별 작업 내용, 날씨, 투입 인원 기록

### 역할 기반 접근
| 역할 | 설명 |
|------|------|
| SUPER_ADMIN | 시스템 전체 관리자 |
| PM | 프로젝트 매니저 (프로젝트 생성/관리) |
| MEMBER | 팀 멤버 |
| CLIENT | 건축주 (제한된 뷰 - 본인 프로젝트만 열람) |

### 건축주 포털
- 건축주 전용 대시보드 (본인 프로젝트만 표시)
- 요청사항 등록 및 진행 상태 확인
- 프로젝트 진행 현황 열람

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query |
| Backend | Express 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL (Railway) / In-memory (개발) |
| Auth | JWT + bcrypt |
| Deploy | Railway |

## 프로젝트 구조

```
├── client/                  # 프론트엔드
│   └── src/
│       ├── components/      # UI 컴포넌트 (shadcn/ui + 커스텀)
│       ├── pages/           # 페이지 컴포넌트
│       │   ├── dashboard.tsx       # 관리자 대시보드
│       │   ├── projects.tsx        # 프로젝트 목록
│       │   ├── project-detail.tsx  # 프로젝트 상세 (탭 기반)
│       │   ├── client-dashboard.tsx # 건축주 대시보드
│       │   ├── client-project.tsx  # 건축주 프로젝트 뷰
│       │   ├── login.tsx           # 로그인
│       │   └── settings.tsx        # 설정
│       ├── lib/             # API 클라이언트, 인증, 유틸
│       └── hooks/           # 커스텀 훅
├── server/                  # 백엔드
│   ├── index.ts             # 서버 엔트리 (Express + Vite)
│   ├── routes.ts            # API 라우트 (REST)
│   ├── storage.ts           # 스토리지 인터페이스 + 메모리 구현
│   ├── pg-storage.ts        # PostgreSQL 구현
│   ├── auto-migrate.ts      # DB 자동 마이그레이션 + 시드
│   └── db.ts                # DB 연결
├── shared/
│   └── schema.ts            # Drizzle 스키마 + TypeScript 타입
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── drizzle.config.ts
```

## 로컬 개발

### 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 (.env 생성)
cp .env.example .env
```

`.env` 파일:
```
DATABASE_URL=postgresql://user:password@localhost:5432/buildflow
JWT_SECRET=your-secret-key
```

> `DATABASE_URL`이 없으면 인메모리 스토리지로 동작합니다 (서버 재시작 시 데이터 초기화).

### 실행

```bash
# 개발 서버 (프론트 + 백엔드 동시 실행, 포트 5000)
npm run dev

# DB 스키마 푸시 (PostgreSQL 사용 시)
npm run db:push

# 타입 체크
npm run check

# 프로덕션 빌드
npm run build
npm start
```

### 기본 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 (PM) | admin@buildflow.com | admin123 |
| 건축주 (CLIENT) | client@buildflow.com | client123 |

> 인메모리 모드에서는 두 계정 모두 사용 가능. PostgreSQL 모드에서는 admin만 자동 시드됩니다.

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보
- `PATCH /api/auth/change-password` - 비밀번호 변경

### 프로젝트
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects/:id` - 프로젝트 상세
- `PATCH /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제
- `GET/PATCH /api/projects/:id/phases` - 페이즈 조회/변경

### 프로젝트 하위 리소스
- `GET/POST /api/projects/:id/members` - 멤버
- `GET/POST /api/projects/:id/schedules` - 일정
- `GET/POST /api/projects/:id/daily-logs` - 일일기록
- `GET/POST /api/projects/:id/files` - 파일(링크)
- `GET/POST /api/projects/:id/photos` - 사진
- `GET/POST /api/projects/:id/requests` - 건축주 요청
- `GET/POST /api/projects/:id/design-changes` - 설계변경
- `GET/POST /api/projects/:id/design-checks` - 설계 체크리스트
- `GET/POST /api/projects/:id/construction-tasks` - 공정
- `GET/POST /api/projects/:id/inspections` - 검수
- `GET/POST /api/projects/:id/defects` - 하자

### 사용자 관리
- `GET /api/users` - 사용자 목록
- `POST /api/users` - 사용자 생성
- `PATCH /api/users/:id` - 사용자 수정
- `DELETE /api/users/:id` - 사용자 삭제 (PM/SUPER_ADMIN만)

## 배포 (Railway)

이 프로젝트는 Railway에 배포되어 있습니다.

- **빌드 커맨드**: `npm run build`
- **시작 커맨드**: `npm start`
- **필수 환경변수**: `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Railway PostgreSQL 플러그인으로 DB 자동 프로비저닝
- 서버 시작 시 `auto-migrate.ts`가 테이블 생성 및 admin 시드 자동 실행

## 라이선스

MIT
