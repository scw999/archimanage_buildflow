# BuildFlow - 건축 프로젝트 관리 시스템

건축사사무소를 위한 프로젝트 관리 웹앱입니다. 설계부터 포트폴리오 촬영까지 건축 프로젝트의 전 과정을 단계별로 관리합니다.

현재 레포 기준으로는 **React + Express + PostgreSQL/인메모리 저장소** 기반의 메인 앱이 있고, 별도로 **Cloudflare Worker/D1/R2 실험용 API 워커**가 포함되어 있습니다. 워커 쪽 설정에는 `buildworking.com` / `api.buildworking.com` 연결 정보가 들어 있습니다.

## 현재 배포/연결 정보

- 메인 도메인 관련 운영 정보: **buildworking.com**
- 워커 API 라우트 설정: **api.buildworking.com**
- 워커 설정 위치: `worker/wrangler.toml`
- 메인 서버는 `server/` 기준 Express 앱이며, 개발 시 Vite와 함께 구동됩니다.

> 참고: 이 레포에는 **메인 Node/Express 서버**와 **Cloudflare Worker 실험 경로**가 같이 있습니다. README는 두 구조를 모두 반영합니다.

---

## 주요 기능

### 프로젝트 페이즈 관리
5단계 프로젝트 진행 관리:
- **설계** (`DESIGN`) - 도면, 설계 체크리스트, 설계변경 이력
- **인허가** (`PERMIT`) - 인허가 서류, 일정 관리
- **시공** (`CONSTRUCTION`) - 공정관리, 일일기록, 검수, 하자관리
- **준공** (`COMPLETION`) - 최종 검수, 하자 처리
- **포트폴리오** (`PORTFOLIO`) - 완공 사진 촬영 및 정리

### 핵심 기능
- **프로젝트 대시보드** - 전체 프로젝트 현황 요약
- **프로젝트 상세** - 일정, 일일기록, 파일, 사진, 건축주 요청, 설계변경, 공정관리, 검수, 하자 탭
- **파일 관리** - 구글 드라이브 링크 기반 도면/문서 관리
- **사진 관리** - 시공 현장 사진 기록 (URL + 업로드 저장소 지원)
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
| `SUPER_ADMIN` | 시스템 전체 관리자 |
| `PM` | 프로젝트 매니저 (프로젝트 생성/관리) |
| `MEMBER` | 팀 멤버 |
| `CLIENT` | 건축주 (제한된 뷰 - 본인 프로젝트만 열람) |

### 건축주 포털
- 건축주 전용 대시보드 (본인 프로젝트만 표시)
- 요청사항 등록 및 진행 상태 확인
- 프로젝트 진행 현황 열람

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query |
| Backend | Express 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL (`DATABASE_URL`) / In-memory fallback |
| Auth | JWT + bcryptjs |
| File Storage | 로컬 업로드 또는 Cloudflare R2 (`server/r2.ts`) |
| Worker (실험/보조) | Cloudflare Worker, D1, R2 |

---

## 프로젝트 구조

```text
.
├── client/                  # 프론트엔드
│   ├── index.html
│   └── src/
│       ├── components/      # UI 컴포넌트 (shadcn/ui + 커스텀)
│       ├── hooks/           # 커스텀 훅
│       ├── lib/             # API 클라이언트, 인증, 유틸
│       └── pages/           # 페이지 컴포넌트
├── server/                  # 메인 백엔드 (Express)
│   ├── index.ts             # 서버 엔트리
│   ├── routes.ts            # REST API
│   ├── storage.ts           # 스토리지 인터페이스 + 인메모리 구현
│   ├── pg-storage.ts        # PostgreSQL 구현
│   ├── auto-migrate.ts      # DB 자동 마이그레이션 + 시드
│   ├── seed.ts              # 시드 스크립트
│   ├── db.ts                # DB 연결
│   └── r2.ts                # R2 / 로컬 파일 저장 추상화
├── shared/
│   └── schema.ts            # Drizzle 스키마 + 타입
├── script/
│   └── build.ts             # 프로덕션 빌드 스크립트
├── worker/                  # Cloudflare Worker 경로
│   ├── src/
│   ├── migrations/
│   ├── wrangler.toml
│   └── package.json
├── package.json
├── drizzle.config.ts
├── vite.config.ts
└── tailwind.config.ts
```

---

## 로컬 개발

### 1) 환경 설정

```bash
npm install
cp .env.example .env
```

### 2) `.env` 예시

```env
DATABASE_URL=postgresql://user:password@localhost:5432/buildflow
JWT_SECRET=change-me-to-a-random-secret

# Cloudflare R2 (optional - without these, files are stored locally)
# R2_ACCOUNT_ID=your-account-id
# R2_ACCESS_KEY_ID=your-access-key
# R2_SECRET_ACCESS_KEY=your-secret-key
# R2_BUCKET_NAME=buildflow-photos
# R2_PUBLIC_URL=https://your-r2-domain.com
```

설명:
- `DATABASE_URL`이 없으면 **인메모리 스토리지**로 동작합니다.
- R2 환경변수가 없으면 사진/파일은 **로컬 파일 저장소**로 동작합니다.
- R2 설정이 있으면 `server/r2.ts`에서 Cloudflare R2를 사용합니다.

### 3) 실행

```bash
# 개발 서버 (포트 5000)
npm run dev

# Drizzle schema push
npm run db:push

# 타입 체크
npm run check

# 프로덕션 빌드
npm run build
npm start
```

---

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
- `DELETE /api/users/:id` - 사용자 삭제 (PM/SUPER_ADMIN 권한)

---

## 저장소 / 업로드 방식

메인 서버(`server/r2.ts`) 기준:
- **R2 설정 있음** → Cloudflare R2 업로드
- **R2 설정 없음** → 로컬 `uploads/photos` 저장

즉, 운영 환경에서는 Cloudflare R2를 붙일 수 있고, 로컬 개발에서는 별도 외부 스토리지 없이도 동작합니다.

---

## Worker 경로 (Cloudflare)

`worker/` 디렉터리는 별도 Cloudflare Worker 기반 API 경로입니다.

확인된 사항:
- Worker 이름: `buildflow-api`
- 라우트: `api.buildworking.com/*`
- Zone: `buildworking.com`
- D1 DB 바인딩 사용
- R2 버킷 바인딩 사용

즉, 이 레포는 단순 Railway/Node 앱이 아니라 **Cloudflare Worker 배포 실험/이행 흔적도 포함된 혼합 구조**입니다.

---

## 배포 메모

현재 README 기준으로는 예전 Railway 중심 설명이 있었지만, 코드 기준으로 보면 다음처럼 이해하는 것이 더 정확합니다.

### 메인 앱
- Node/Express 기반
- `npm run build` 후 `npm start`로 실행
- PostgreSQL 또는 인메모리 저장소 사용 가능

### 보조/실험 배포 경로
- `worker/` 아래 Cloudflare Worker
- `api.buildworking.com` 라우트 연결 정보 존재
- D1 / R2 사용

즉 운영 구조는 **단일 경로로 완전히 정리된 상태라기보다, 메인 앱 + 워커 경로가 공존하는 상태**로 보는 게 맞습니다.

---

## 현재 코드 기준으로 남아 있는 정리 포인트

이 README는 코드와 맞추기 위해 업데이트했지만, 아래는 여전히 후속 정리 후보입니다.

- `buildflow` / `buildworking` 네이밍 일관성 정리
- 기본 시드 이메일 도메인 정리 (`admin@buildflow.com` 등)
- Worker와 메인 서버의 역할 분리 문서화 강화
- 실제 운영 배포 경로를 하나로 정리할지 여부 결정

---

## 라이선스

MIT
