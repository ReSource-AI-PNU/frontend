# 산업단지 시드 데이터

데모용 임시 데이터다. 실제 서비스에서는 국토교통부 GIS건물통합정보(VWorld)와 실제 입주 기업 정보로 교체한다.

## 파일

| 경로 | 내용 | 출처 | 라이선스 |
| --- | --- | --- | --- |
| `data/complexes.json` | 부산·경남 산업단지 8곳의 이름, 유형, 중심점, bbox, 면적 | 부산시 산업입지 현황, Invest KOREA, OSM 경계(각 항목 `source`·`boundarySource`) | 사실 정보. 좌표는 OSM 경계에서 읽었다 |
| `public/data/buildings/<id>.geojson` | 단지 bbox 안의 건물 외곽선과 높이 | OpenStreetMap(Overpass API) | ODbL 1.0 |
| `public/data/companies/<id>.json` | 가상 입주 기업(`isDemo: true`) | `scripts/seed-companies.mjs`가 생성 | 가상 데이터. 실존 기업이 아니다 |

- 건물 데이터를 화면에 쓸 때는 반드시 "© OpenStreetMap contributors"를 표기한다. 각 GeoJSON 최상위 `attribution` 필드에도 같은 문구가 있다.
- ODbL은 파생 데이터베이스를 공개 배포할 때 같은 라이선스로 공개할 것을 요구한다. 가공한 건물 데이터를 따로 배포한다면 이 조건을 지킨다.
- `"approximate": true`인 단지(화전, 미음, 지사)는 OSM에 이름 붙은 경계가 없어 주변 지명과 이름 없는 산업용지 폴리곤으로 bbox를 추정했다.
- bbox로 잘라 오므로 단지 밖 주거·학교 건물도 섞인다(신호 남쪽 고층 아파트, 창원 bbox의 아파트 약 770동 등). 산단 건물만 보이려면 `kind`가 `apartments`, `house`, `residential`, `school`인 건물을 거른다. 기업은 공장·창고·일반(`yes`) 건물에만 배정했다.
- OSM 건물 입력 밀도가 단지마다 크게 다르다. 녹산(111동)과 화전(46동)은 실제 입주 규모보다 훨씬 적게 그려져 있다.
- 사상공업지역은 법정 산업단지가 아닌 준공업지역이다. 스키마 제약 때문에 `type`을 "일반"으로 둔다.

## 높이 추정

`properties.heightSource`에 출처를 남긴다. 결과는 정수 미터다.

1. `osm-height`: OSM `height` 태그(미터)를 반올림한다.
2. `osm-levels`: `building:levels` × 4.2m.
3. `estimated`: 위 두 태그가 없으면 건물 유형과 면적으로 정한다.
   - 공장·창고(`industrial`, `warehouse`, `factory`, `manufacture` 등): 면적에 따라 9~14m. 500㎡ 미만 9m, 2,000㎡ 미만 10m, 8,000㎡ 미만 12m, 그 이상 13m를 기준으로 osmId 해시에 따라 0~1m를 더한다.
   - 사무·상업·공공(`office`, `commercial`, `school` 등): 면적에 따라 3~5층 × 4.2m(13m, 17m, 21m).
   - 그 외(`yes` 포함): 8m.

같은 OSM 입력이면 항상 같은 높이가 나온다. OSM 건물 대부분은 태그가 없어 `estimated`다.

## 재생성

```bash
node scripts/fetch-buildings.mjs           # 전체 단지 건물 다시 받기 (Overpass, 단지 사이 5초 대기)
node scripts/fetch-buildings.mjs noksan    # 특정 단지만
node scripts/seed-companies.mjs            # 가상 기업 다시 만들기 (건물 파일이 있어야 한다)
```

- Node 20 이상에서 외부 의존성 없이 동작한다.
- Overpass 서버가 붐비면 502/504를 돌려준다. 스크립트가 지수 백오프로 재시도하고, 그래도 실패한 단지는 건너뛴 뒤 마지막 표에 `failed`로 표시한다. 그 단지 id만 인자로 다시 실행한다.
- relation 멀티폴리곤 건물은 outer 링만 쓴다(안뜰 같은 inner 링은 무시한다).
- 다른 Overpass 인스턴스를 쓰려면 `OVERPASS_URL`, 대기 시간을 바꾸려면 `DELAY_MS`를 지정한다.
- 기업 시드는 고정 seed PRNG를 쓴다. 건물 파일이 바뀌면 배정 건물도 바뀐다.

## 스키마 (VWorld로 교체할 때 맞출 것)

### 건물 GeoJSON

```jsonc
{
  "type": "FeatureCollection",
  "complexId": "noksan",
  "bbox": [minLng, minLat, maxLng, maxLat],
  "attribution": "© OpenStreetMap contributors",   // VWorld면 출처 문구로 교체
  "license": "ODbL-1.0",
  "osmBaseTimestamp": "2026-11-09T10:00:00Z",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Polygon" | "MultiPolygon", "coordinates": [...] }, // WGS84 경위도, 소수점 6자리
    "properties": {
      "height": 12,                  // 정수 m
      "heightSource": "osm-height" | "osm-levels" | "estimated",
      "osmId": 123456789,           // 숫자. way는 양수 id, relation(멀티폴리곤)은 -relationId. 지도 promoteId와 기업 buildingOsmId가 이 값을 쓴다
      "kind": "industrial"          // OSM building 태그 값
    }
  }]
}
```

VWorld 건물통합정보로 바꿀 때는 다음을 맞춘다.

- 좌표계: VWorld 원본은 보통 EPSG:5186 등 TM 좌표다. EPSG:4326 경위도로 변환한다.
- `height`: 건물 높이 속성을 쓰고, 없으면 지상층수 × 4.2m로 계산한 뒤 `heightSource`를 그에 맞게 둔다(값 이름은 `"vworld-height"`, `"vworld-levels"`처럼 새로 정해도 된다).
- `osmId`: 지도 feature-state(`promoteId`)와 기업 연결 키다. VWorld 건물 고유번호(예: 건물관리번호)는 문자열이 길어 숫자 안전 범위를 넘을 수 있으므로, 숫자 일련번호로 매핑하거나 문자열 id로 바꾸고 `Company.buildingOsmId` 타입도 함께 바꾼다.
- `kind`: 건축물 주용도(공장, 창고시설, 업무시설 등)를 넣는다. 높이 추정 규칙의 유형 목록도 그에 맞게 바꾼다.

### 기업 JSON

`src/lib/domain.ts`의 `Company[]` 배열이다.

```jsonc
[{
    "id": "noksan-001",
    "name": "(주)한빛정밀 사출공장",
    "buildingOsmId": 123456789,             // 건물 GeoJSON의 properties.osmId
    "location": [lng, lat],                 // 배정 건물 외곽선의 중심점
    "industry": "플라스틱 제품 제조업",      // 한국표준산업분류 업종명(중·소분류 수준)
    "role": "배출" | "처리업체" | "수요처",
    "wasteStreams": [{ "item": "폐플라스틱" | "금속 스크랩" | "폐목재" | "포장재", "detail": "PP 압축품", "monthlyKg": 800, "storage": "실내" | "야외·지붕" | "야외·노출" }],
    "permits": ["폐플라스틱", "포장재"],    // 처리업체만. wasteStreams.item과 같은 어휘
    "demands": [{ "item": "...", "detail": "...", "monthlyKg": 0 }], // 수요처만. 받아 쓰는 재생 원료
    "employees": "50~99명",
    "scenario": "hanbit-anchor",            // 녹산 데모 시나리오 기업만
    "note": "...",                          // 선택
    "isDemo": true
}]
```

녹산 데모 시나리오(`scenario` 필드):

- `hanbit-anchor`: (주)한빛정밀 사출공장. PP 압축품 월 800kg, 야외·지붕 보관.
- `pp-bundle`: 한빛정밀과 가장 가까운 건물 3곳의 PP 소량 배출 기업. 세 곳 합계 1,350kg, 한빛정밀과 합치면 월 2,150kg이다.
- `recycler-match`: (주)녹산리사이클. 폐플라스틱·포장재 허가가 있다.
- `permit-mismatch`: (주)동남환경. 폐플라스틱 허가가 없어 PP를 맡기면 허가 불일치 경고가 떠야 한다.
