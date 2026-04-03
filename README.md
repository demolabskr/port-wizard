# Port Wizard

여러 프로젝트가 사용하는 포트를 한곳에 모아 관리하는 간단한 TypeScript CLI다.

핵심 목적은 두 가지다.

- 현재 코드베이스들이 어떤 포트를 사용하도록 설정되어 있는지 `JSON`으로 남긴다.
- 새 프로젝트를 만들 때 그 `JSON`을 보고 포트 충돌을 피한다.

현재 포트 정보는 `data/ports.json`에 저장된다.
이 파일은 로컬에서 생성되는 실행 결과물이며, 공개 저장소에는 포함하지 않는다.

## What It Tracks

`port-wizard`는 설정된 프로젝트 루트 바로 아래의 프로젝트를 스캔한다.

읽는 파일은 다음과 같다.

- `docker-compose.yml`
- `docker-compose.yaml`
- `.env`
- `.env.local`
- `package.json`

수집 대상 예시는 다음과 같다.

- Docker host port: `127.0.0.1:5437:5432`
- 앱/DB 포트 변수: `PORT=3000`, `WEB_PORT=18120`, `POSTGRES_PORT=5434`
- URL 안의 포트: `http://localhost:3900`, `postgresql://...:5210/...`
- package script 안 포트: `vite --port 1420`, `next dev -p 3900`

## Install

```bash
git clone <your-port-wizard-repo-url>
cd port-wizard
npm install
npm run build
```

개발 중에는 `tsx` 스크립트로 바로 실행할 수 있고, 빌드 후에는 `dist/cli.js`를 직접 실행할 수 있다.

## Commands

### 1. Scan current projects

```bash
npm run scan
```

또는:

```bash
node dist/cli.js scan
```

실행하면 설정된 프로젝트 루트 아래 최상위 프로젝트들을 스캔하고 `data/ports.json`을 갱신한다.
`data/ports.json`이 없으면 이때 자동으로 생성된다.

### 2. List recorded ports

```bash
npm run list
```

JSON 그대로 보고 싶으면:

```bash
node dist/cli.js list --json
```

### 3. Suggest available ports

앱 포트 추천:

```bash
node dist/cli.js suggest --purpose app --count 5
```

DB 포트 추천:

```bash
node dist/cli.js suggest --purpose db --count 5
```

기본 추천 범위:

- `app`: `3000-3999`, `8000-8999`
- `db`: `5400-5999`
- `admin`: `9000-9999`
- `other`: `10000-10999`

### 4. Reserve a port

```bash
node dist/cli.js reserve --project my-new-project --port 3012 --purpose app --note "planned frontend"
```

예약 정보는 로컬 `data/ports.json`의 `reservations[]`에 저장된다.

이미 다른 프로젝트가 쓰고 있는 포트나 이미 예약된 포트는 거부한다.

## JSON Format

예시 구조:

```json
{
  "generatedAt": "2026-04-03T09:55:33.427Z",
  "rootPath": "/path/to/projects",
  "projects": [
    {
      "name": "bitomun-nextjs",
      "path": "/path/to/projects/bitomun-nextjs",
      "ports": [
        {
          "port": 3900,
          "purpose": "app",
          "status": "detected",
          "confidence": "reference",
          "sources": [
            {
              "file": "bitomun-nextjs/.env",
              "kind": "env",
              "detail": "NEXT_PUBLIC_APP_URL URL=3900"
            }
          ]
        }
      ]
    }
  ],
  "reservations": []
}
```

의미:

- `projects[]`: 코드베이스에서 감지한 포트
- `reservations[]`: 수동으로 예약한 포트
- `confidence=confirmed`: 포트 선언이 비교적 명확함
- `confidence=reference`: URL, 스크립트 등 참고성 정보에서 추출함

## Recommended Workflow For New Projects

새 프로젝트를 시작할 때는 이 순서를 권장한다.

1. `port-wizard` 최신 내용을 pull 받는다.
2. `npm run scan`으로 현재 프로젝트 포트 현황을 갱신한다.
3. 로컬에서 생성된 `data/ports.json`을 확인한다.
4. `suggest`로 비어 있는 포트를 찾는다.
5. 사용할 포트를 정하면 `reserve`로 먼저 기록한다.
6. 새 프로젝트의 `.env`, `docker-compose.yml`, `package.json`에 같은 포트를 반영한다.

## How To Instruct Another Agent Or Project

새 프로젝트를 생성할 때 다른 사람이나 에이전트에게는 아래처럼 전달하면 된다.

```text
Use the port-wizard repository first.
Run the scanner first, then check the local data/ports.json file and avoid any ports already detected or reserved there.
Pick a non-conflicting port for the new project, then update the new project's env/package/docker config with that port.
```

조금 더 구체적으로 쓰면:

```text
Before choosing ports for this project, inspect the port-wizard repo.
Read the local port-wizard/data/ports.json file created after scanning.
Do not reuse ports already present in projects[] or reservations[].
Choose a free app port and DB port, preferably from the suggested ranges.
```

## Important Notes

- 이 도구는 현재 “코드에 설정된 포트”를 기준으로 관리한다.
- 즉, 실제 OS에서 현재 열려 있는 포트를 실시간으로 검사하는 도구는 아직 아니다.
- 따라서 이 JSON은 “프로젝트들이 사용하도록 설정된 포트 레지스트리”로 이해하면 된다.
- 실제 실행 중 포트 검사까지 필요하면 추후 `lsof` 기반 live check를 추가할 수 있다.
- 프로젝트 루트 경로는 코드에서 설정하며, 공개 README에서는 특정 개인 로컬 경로를 전제하지 않는다.
- `data/ports.json`은 각 사용자의 로컬 환경에서 생성되며, Git으로 추적하지 않는다.

## Files

- `src/cli.ts`: CLI entrypoint
- `src/scanner.ts`: 포트 스캔 로직
- `src/registry.ts`: JSON 로드/저장
- `data/ports.json`: 로컬에서 생성되는 포트 레지스트리
