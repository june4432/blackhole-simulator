# 버그 및 TODO 목록

## 버그

### 1. 입자 발사 기능 동작 안함 ❌
- **증상**: Space 키나 클릭으로 입자 발사가 안됨
- **추정 원인**:
  1. 레이트레이서 모드가 기본이라 3D 객체(입자)가 안 보임
  2. 레이트레이서는 별도 씬을 렌더링하므로 입자가 표시 안됨
  3. 입자는 `this.scene`에 추가되지만, 레이트레이서는 `this.rtScene`을 렌더링

- **해결 방안**:
  1. R키로 기존 모드 전환 시 입자가 보이는지 확인
  2. 레이트레이서 모드에서도 입자 궤적을 표시하려면:
     - 입자 위치를 셰이더로 전달
     - 또는 레이트레이서 위에 입자 레이어 오버레이
  3. 두 모드 통합 필요

- **관련 코드**:
  - `src/objects/Particle.js` - 입자 생성 및 물리
  - `src/BlackHoleSimulator.js` - `launchParticle()`, `launchParticleToward()`
  - `src/effects/BlackHoleRaytracer.js` - 레이트레이서 (별도 씬)

## TODO (내일)

### 1. Eric Bruneton 논문 기반 최적화
- [ ] Precomputed deflection map 구현
- [ ] O(n) 루프 → O(1) 텍스처 룩업
- [ ] 다중 이미지 효과 (광자구)

### 2. 입자 시스템 수정
- [ ] 레이트레이서 모드에서 입자 표시
- [ ] 두 렌더링 모드 통합
- [ ] 입자 궤적을 레이트레이서 셰이더에 전달?

### 3. 추가 기능
- [ ] 회전 블랙홀 (Kerr metric)
- [ ] GAIA 실제 별 데이터 사용
- [ ] 호킹 복사 시각화?
