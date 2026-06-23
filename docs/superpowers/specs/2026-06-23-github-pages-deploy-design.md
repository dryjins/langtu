Deploying the web MVP to GitHub Pages

1) 목표

- 모바일 웹앱을 GitHub Pages에서 바로 실행 가능한 정적 사이트로 배포한다.
- APK 빌드 흐름은 유지하고, 현재 요청의 배포 대상은 웹 사이트 테스트 링크 제공이다.
- 배포 시 `npm test`를 통과하지 않으면 배포가 진행되지 않도록 한다.

2) 배포 아키텍처

- 정적 산출물 경로는 기존 `npm run web:prepare`가 생성하는 `www/`를 사용한다.
- GitHub Actions에서 `main` 브랜치 푸시 시 워크플로우를 실행한다.
- 워크플로우는 `npm ci`, `npm test`, `npm run web:prepare`, Pages artifact 업로드 단계를 수행한다.
- 업로드된 artifact를 GitHub Pages에 배포한다.

3) 변경 파일

- `.github/workflows/pages.yml`
  - `on`: `push`(main), `workflow_dispatch`
  - `build` 작업: 설치, 테스트, `web:prepare`, artifact 업로드
  - `deploy` 작업: Pages 배포
- `README.md`
  - GitHub Pages 배포 안내 링크와 모바일 웹 배포 테스트 절차를 정리한다.

4) 배포 정책

- 보안/정책상 공개 데이터만 배포한다.
- private bundle, 저작권 텍스트, 오디오 자산은 저장소에 포함하지 않는다.
- 배포 artifact는 `www/` 이하 정적 파일만 포함한다.

5) 검증 방식

- 로컬: `npm test` 통과 확인.
- CI: PR/푸시 시 workflow 실행 결과에서 테스트 및 Pages 배포 단계를 확인한다.
- 배포 후: 브라우저에서 GitHub Pages URL 접속 후 기본 번들 시작 화면 및 bundle import 흐름 검증.
