# Epic 09: 3D Investigation

**Priority tier:** P1
**Owner:** Developer D
**Depends on:** Epic 01, Epic 02, Epic 03, Epic 04

## Goal
Provide a premium, Bruno Simon-inspired interactive 3D sandbox for investigating environmental incidents, combining a guided cinematic onboarding sequence with a free-roam exploration mode.

## Definition of Done
- A React Three Fiber (R3F) canvas renders stylized terrain and project boundaries.
- The 3D scene receives its visual state entirely from backend API data (no fabricated anomalies).
- A cinematic camera sequence introduces the incident before yielding to user control.
- Free-roam mode supports WASD and mouse look constrained to the project bounds.
- **Crucially, the core P0 workflow functions flawlessly without this epic being complete.**

---

## Story 09.1: 3D Scene Integration and Fallback

**Owner:** Developer D
**Depends on:** 07.3

**As a** user
**I want** to launch a 3D investigation from the 2D UI
**So that** I can explore the incident spatially.

### Acceptance Criteria
- [ ] The "Investigate in 3D" button mounts a separate R3F canvas overlay.
- [ ] If WebGL is unavailable or fails to initialize, the application degrades gracefully to the 2D view without crashing.
- [x] The 3D scene loads real `ProjectBoundary` GeoJSON and incident data from the API to dictate its visual state (e.g., rendering smoke only if an active anomaly exists).

### Technical notes
- PRD 3.2 (P1), PRD 10.0 (Failures)
- Architecture Spine AD-11 (3D Independence)

---

## Story 09.2: Cinematic Guided Sequence

**Owner:** Developer D
**Depends on:** 09.1

**As a** new user
**I want** a guided cinematic introduction to the 3D world
**So that** I understand the context and controls before exploring manually.

### Acceptance Criteria
- [ ] Upon entering the 3D scene, a pre-programmed camera sequence (using GSAP or equivalent) flies over the terrain.
- [ ] UI overlays introduce the project, the anomaly, and teach WASD/mouse controls.
- [x] The cinematic sequence is skippable by the user.

### Technical notes
- Architecture Spine AD-11, PRD 7.0

---

## Story 09.3: Free-Roam Investigation Sandbox

**Owner:** Developer D
**Depends on:** 09.2

**As a** user
**I want** to freely explore the 3D terrain
**So that** I can inspect evidence hotspots from different angles.

### Acceptance Criteria
- [x] After the cinematic sequence ends, control seamlessly transitions to the user.
- [x] WASD movement and mouse look (with pointer lock) allow exploration.
- [x] Movement is constrained by a bounding box or collision system so the user cannot wander infinitely into empty space.
- [x] The user can click or interact with specific evidence hotspots to open contextual UI panels.

### Technical notes
- Architecture Spine AD-11, PRD 7.0
