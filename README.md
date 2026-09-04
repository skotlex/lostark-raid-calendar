# 로스트아크 길드 레이드 편성표

요일별 레이드 슬롯에 길드원이 캐릭터를 배치하는 웹앱. 기존에 쓰던 Google 시트를 대체한다.

기존 시트에서 불편했던 세 가지를 고치는 것이 목적이다.

1. **캐릭터 스펙이 `#REF!`로 깨져 있었다** → 로아 공식 OpenAPI로 클래스·템레벨·전투력·
   각인·아크그리드를 자동 조회한다
2. **매주 인원을 손으로 지워야 했다** → 수요일 오전 6시 리셋에 맞춰 자동으로 비워진다.
   고정 공대는 자리 단위 또는 레이드 단위로 승계를 켤 수 있다
3. **셀 편집이라 남의 신청을 실수로 지우기 쉬웠다** → 슬롯 단위 UI와 변경 기록

## 쓰려면 직접 준비해야 한다

이 저장소에는 인증 정보가 들어 있지 않다. 본인의 키와 DB가 필요하다.

### 1. 로아 OpenAPI 키

[개발자 포털](https://developer-lostark.game.onstove.com)에서 클라이언트를 만들면 JWT가
바로 발급된다. 무료다.

### 2. Postgres

[Neon](https://neon.tech) 무료 프로젝트면 충분하다. 지역은 **싱가포르
(`aws-ap-southeast-1`)** 를 고른다. Neon은 한국·일본에 지역이 없고, 생성 후에는
지역을 바꿀 수 없다.

콘솔의 Connect 화면에서 **접속 문자열 두 개**를 모두 복사한다. 호스트에 `-pooler`가
붙은 것이 앱용, 붙지 않은 것이 마이그레이션용이다.

### 3. 환경변수

```bash
cp .env.example .env.local
# .env.local을 열어 값을 채운다:
#   DATABASE_URL           풀링 (-pooler 붙은 쪽)
#   DATABASE_URL_UNPOOLED  직결 (-pooler 없는 쪽)
#   LOSTARK_API_KEY        로아 OpenAPI JWT
```

### 4. 실행

```bash
npm install
npm run db:generate    # Prisma 클라이언트 생성 (커밋되지 않으므로 필요)
npm run db:push        # 스키마를 DB에 반영
npm run db:seed        # 기본 인스턴스 생성
npm run dev
```

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 유닛 테스트 |
| `npm run probe -- 캐릭터명` | 로아 API 응답 구조 확인 (각인·아크그리드 필드 파악용) |
| `npm run db:push` | 스키마를 DB에 반영 |
| `npm run db:seed` | 기본 인스턴스 생성 (`-- --with-samples`로 예시 슬롯까지) |
| `npm run db:studio` | Prisma Studio로 데이터 직접 확인 |

## 권한과 개인정보

- 로아 OpenAPI는 **공개 캐릭터 정보만** 읽는다. 계정 정보에 접근하지 않는다
- API 키는 서버에서만 쓰인다. 브라우저로 전달되지 않는다
- **로그인이 없다.** 링크를 아는 사람은 누구나 편집할 수 있는 구조를 의도적으로 택했다.
  누가 무엇을 바꿨는지는 변경 기록에 남지만, 이름은 본인이 입력한 값일 뿐 검증되지 않는다

## 개발

| 문서 | 내용 |
|---|---|
| `CLAUDE.md` | 프로젝트 컨텍스트 및 규칙 |
| `prisma/schema.prisma` | 데이터 모델. 슬롯과 배정의 분리가 핵심이다 |
| `src/lib/week.ts` | 주차 계산(KST 수요일 06:00 리셋). 유닛 테스트 있음 |
| `src/lib/synergy.ts` | 클래스 → 시너지 / 역할 매핑 |
| `src/lib/lostark.ts` | 로아 API 클라이언트. 레이트리밋과 429 백오프 |

## 라이선스

MIT
