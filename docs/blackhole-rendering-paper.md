# Real-time High-Quality Rendering of Non-Rotating Black Holes

## 논문 정보
- **제목**: Real-time High-Quality Rendering of Non-Rotating Black Holes
- **저자**: Eric Bruneton
- **arxiv**: https://arxiv.org/abs/2010.08735
- **PDF**: https://arxiv.org/pdf/2010.08735

## Abstract
We propose a real-time method to render high-quality images of a non-rotating black hole with an accretion disc and background stars. Our method is based on beam tracing, but uses precomputed tables to find the intersections of each curved light beam with the scene in constant time per pixel.

## 핵심 기술

### 1. Beam Tracing (빔 트레이싱)
- 일반 레이트레이싱의 확장
- 곡선 광선(curved light beam)의 궤적을 추적
- 슈바르츠실트 시공간에서 null geodesic 계산

### 2. Precomputed Tables (미리 계산된 테이블)
- **핵심 최적화**: 픽셀당 O(1) 시간 복잡도
- 광선-장면 교차점을 테이블에서 룩업
- GPU 텍스처로 저장하여 실시간 접근

### 3. Special Texture Filtering
- 광원의 기여도를 각 광선에 통합
- 강착원반의 도플러 효과, 중력 적색편이 처리

## 블랙홀 시뮬레이터 업그레이드 적용 포인트

### 현재 구현 방식
```javascript
// 매 프레임 GPU에서 광선 적분 (비효율적)
for (int i = 0; i < MAX_STEPS; i++) {
  vec3 accel = -1.5 * rs / r3 * pos;
  pos += dir * stepSize;
  dir += accel * stepSize;
}
```

### 논문 기반 최적화 방안

#### 1. Precomputed Deflection Map
- 입사각(impact parameter) → 편향각(deflection angle) 테이블
- GPU 텍스처로 저장
- **효과**: 루프 제거, O(n) → O(1)

#### 2. Precomputed Disk Intersection
- 광선이 강착원반과 교차하는 위치 미리 계산
- (r, φ) 좌표를 텍스처에 저장

#### 3. Einstein Ring Lookup
- 광자구 근처 다중 이미지 효과
- 빛이 여러 바퀴 도는 경로 미리 계산
- 더 정확한 아인슈타인 링 렌더링

## 구현 계획

### Phase 1: Deflection Map 생성
```javascript
// 오프라인 계산 (Node.js 또는 빌드 타임)
function generateDeflectionMap(resolution = 1024) {
  const map = new Float32Array(resolution * 4);

  for (let i = 0; i < resolution; i++) {
    const b = (i / resolution) * maxImpactParameter;
    const { deflection, rMin, windingNumber } = integrateGeodesic(b);

    map[i * 4 + 0] = deflection;      // 총 편향각
    map[i * 4 + 1] = rMin;            // 최소 접근 거리
    map[i * 4 + 2] = windingNumber;   // 궤도 회전수
    map[i * 4 + 3] = 0;               // reserved
  }

  return map;
}
```

### Phase 2: GPU Lookup Shader
```glsl
// 현재: 루프로 적분 (느림)
// 개선: 텍스처 룩업 (빠름)

uniform sampler2D deflectionMap;

vec4 lookupDeflection(float impactParameter) {
  float u = impactParameter / maxB;
  return texture2D(deflectionMap, vec2(u, 0.5));
}

// 사용
float deflection = lookupDeflection(b).r;
float rMin = lookupDeflection(b).g;
```

### Phase 3: Multi-orbit Images (다중 이미지)
- 광자구(r = 1.5rs) 근처에서 빛이 n바퀴 도는 경우
- 각 n에 대해 별도 이미지 레이어
- 강착원반의 앞/뒤 면 구분

## 참고 수식

### 슈바르츠실트 메트릭
```
ds² = -(1-rs/r)dt² + (1-rs/r)⁻¹dr² + r²dΩ²
```

### 빛의 편향각 (약한 장 근사)
```
α = 4GM/(c²b) = 2rs/b
```

### 빛의 편향각 (강한 장, 정확한 적분)
```
α = 2 ∫[r_min→∞] (b/r²) / √(1 - b²(1-rs/r)/r²) dr - π
```

### Impact Parameter와 최소 접근 거리 관계
```
b² = r_min² / (1 - rs/r_min)
```

### 광자구에서의 Critical Impact Parameter
```
b_crit = (3√3 / 2) × rs ≈ 2.598 × rs
```

## 예상 성능 향상

| 항목 | 현재 | 논문 적용 후 |
|------|------|-------------|
| 픽셀당 연산 | O(200) 루프 | O(1) 텍스처 룩업 |
| FPS (1080p) | ~30fps | ~60fps+ |
| 다중 이미지 | 미지원 | 지원 |
| 메모리 | 낮음 | +2MB (텍스처) |

## 추가 참고 자료
- Interstellar 논문: "Gravitational Lensing by Spinning Black Holes" (Kip Thorne)
- GPU Gems: Real-time rendering techniques
- Shadertoy 블랙홀 예제들

## 저자 구현체 (매우 중요!)

### GitHub 저장소
- **URL**: https://github.com/ebruneton/black_hole_shader
- **데모**: https://ebruneton.github.io/black_hole_shader/
- **논문 PDF**: https://ebruneton.github.io/black_hole_shader/paper.pdf

### 저장소 구조
```
black_hole_shader/
├── black_hole/     # 핵심 블랙홀 렌더링 코드
├── bloom/          # 블룸 이펙트
├── color_maps/     # 색상 맵 데이터
├── gaia_sky_map/   # GAIA 별 데이터 (실제 별 위치!)
├── rocket/         # 카메라/시뮬레이션 제어
└── tools/          # 유틸리티
```

### 기술 스택
- **C++ (36.8%)**: Precomputation 도구
- **GLSL (12.5%)**: 실시간 셰이더
- **JavaScript (23.9%)**: WebGL2 인터페이스

### 구현된 물리 효과
1. 중력 렌즈 효과 (빛의 경로 굽힘)
2. 상대론적 도플러 효과 (색 변화)
3. 상대론적 빔 효과 (광도 변화)
4. 로렌츠 수축 (길이 수축)

### 핵심 알고리즘 흐름
```
1. Precompute (C++, 오프라인):
   - 광선 편향 테이블 생성
   - 강착원반 교차점 테이블 생성
   - 텍스처로 저장

2. TraceRay (GLSL, 실시간):
   - 픽셀당 광선 방향 계산
   - 테이블 룩업으로 편향각 획득 (O(1))
   - 강착원반/배경별 샘플링
```

## 광자구와 다중 이미지

논문에서 언급된 핵심 물리:
```
e² > μ_max = 4/27 (광자구 u = 2/3에서)
→ 모든 u 값 가능 (빛이 블랙홀로 들어감)

e² < μ_max
→ 빛이 apsis ua < 2/3에 도달 후 탈출
→ 이 경우 다중 이미지 발생 가능
```

## 내일 할 일

### 1단계: 저자 코드 분석
```bash
git clone https://github.com/ebruneton/black_hole_shader
# black_hole/ 폴더의 GLSL 셰이더 분석
# preprocess/ 폴더의 C++ 코드 분석
```

### 2단계: Precomputation 테이블 생성
- JavaScript로 포팅하거나
- 저자의 사전계산 데이터 사용

### 3단계: 셰이더 최적화
- 현재 루프 기반 → 테이블 룩업 기반으로 변경

## 메모
- 이 논문의 핵심은 **미리 계산(precomputation)**
- 현재 구현은 매 프레임 적분하므로 비효율적
- 텍스처 룩업으로 대체하면 더 복잡한 효과 추가 가능
- 커 블랙홀(회전 블랙홀)은 더 복잡하지만 같은 원리 적용 가능
- **저자의 데모 사이트에서 직접 테스트 가능!**
