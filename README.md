# Black Hole Simulator

일반상대성이론 기반의 블랙홀 시뮬레이터입니다. 인터스텔라 영화의 가르강튀아처럼 물리적으로 정확한 블랙홀 시각화를 제공합니다.

![Black Hole](https://img.shields.io/badge/Physics-General%20Relativity-blue)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### Gravitational Effects
- **Gravitational Lensing** - 블랙홀 주변에서 빛이 휘어지는 현상
- **Einstein Ring** - 뒤쪽 별빛이 고리 형태로 보임
- **Photon Sphere** - 3GM/c² 근처에서 빛이 궤도를 도는 영역

### Accretion Disk
- **Interstellar-style Colors** - 흑체복사 기반 노랑-오렌지 색상
- **Doppler Effect** - 다가오는 쪽은 밝고 파랗게, 멀어지는 쪽은 어둡고 붉게
- **Relativistic Beaming** - 상대론적 밝기 증폭
- **Gravitational Redshift** - 중력에 의한 적색편이
- **Multiple Images** - 디스크가 위아래로 휘어 보이는 효과

### Kerr Black Hole (Rotating)
- **Frame Dragging** - 시공간이 블랙홀과 함께 회전
- **Ergosphere** - 에르고스피어 시각화
- **Spin Parameter** - 0 ~ 0.998 범위 조절 가능

### Particle Simulation
- **Geodesic Motion** - 측지선 방정식 기반 궤도 계산
- **RK4 Integration** - 4차 룽게-쿠타 수치 적분
- **Spaghettification** - 조석력에 의한 늘어남 효과
- **Time Dilation** - 중력에 의한 시간 지연 시각화

## Installation

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## Controls

### Mouse
- **Click** - 커서 방향으로 파티클 발사
- **Drag** - 카메라 회전
- **Scroll** - 줌 인/아웃

### Keyboard
| Key | Function |
|-----|----------|
| `Space` | 랜덤 파티클 발사 |
| `K` | Kerr (회전) 블랙홀 토글 |
| `[ ]` | Kerr 스핀 조절 |
| `E` | 에르고스피어 표시 |
| `R` | 레이트레이서 모드 토글 |
| `A` | 강착원반 토글 |
| `H` | 헬퍼 링 (광자구체, ISCO) 표시 |
| `T` | 시간 지연 필드 표시 |
| `L` | 중력 렌즈 효과 토글 |
| `C` | 모든 파티클 제거 |

### UI Sliders
- **Black Hole Mass** - 블랙홀 질량 (태양질량 단위)
- **Particle Velocity** - 파티클 초기 속도
- **Simulation Speed** - 시뮬레이션 배속 (0.2x ~ 4x)
- **Spin Parameter** - Kerr 블랙홀 회전 속도

## Physics

### Schwarzschild Metric
비회전 블랙홀의 시공간 기하학:
```
ds² = -(1-rs/r)dt² + (1-rs/r)⁻¹dr² + r²dΩ²
```

### Kerr Metric
회전 블랙홀의 시공간 기하학 (Boyer-Lindquist 좌표):
```
Δ = r² - 2Mr + a²
Σ = r² + a²cos²θ
```

### Key Radii
- **Event Horizon**: rs = 2GM/c²
- **Photon Sphere**: 1.5 rs
- **ISCO** (Innermost Stable Circular Orbit): 3 rs (Schwarzschild)

## Tech Stack

- **Three.js** - 3D WebGL 렌더링
- **GLSL Shaders** - GPU 레이트레이싱
- **Vite** - 빌드 도구

## References

- Kip Thorne, "The Science of Interstellar" (2014)
- Eric Bruneton, "Precomputed Atmospheric Scattering" (black hole adaptation)
- James et al., "Gravitational lensing by spinning black holes" (2015)

## License

MIT License
