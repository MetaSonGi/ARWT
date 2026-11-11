# ARWT 구현 기능 정리

Unity WebGL 빌드를 브라우저에서 AR로 실행하는 프로젝트입니다. 원본은 [ToughNutToCrack/ARWT](https://github.com/ToughNutToCrack/ARWT) (MIT 라이선스)이며, 이 저장소는 그것을 **Unity 2021.3.36f1**로 마이그레이션한 버전입니다.

크게 두 가지 방식을 지원합니다.

| 방식 | 기반 기술 | 씬 템플릿 | 특징 |
|---|---|---|---|
| **WebAR (마커 기반)** | AR.js + A-Frame | `Assets/WebGLTemplates/WebAR` | 대부분의 모바일/PC 브라우저, 카메라만 있으면 동작 |
| **WebXR (마커리스)** | WebXR Device API + three.js | `Assets/WebGLTemplates/WebXR` | Android Chrome(ARCore) 필요, 평면 인식·이미지 추적 |

---

## 1. WebAR — 마커 기반 AR

### 동작 구조
1. 브라우저의 A-Frame/AR.js(`WebGLTemplates/WebAR/js/app.js`)가 카메라 영상에서 마커를 인식합니다.
2. 매 프레임 마커의 `이름, 보임 여부, 위치, 회전(쿼터니언), 스케일`을 문자열로 직렬화해 `unityInstance.SendMessage("DetectionManager", "markerInfos", ...)`로 Unity에 전달합니다.
3. 카메라의 projection 행렬·위치·회전도 `Main Camera`로 보내 Unity 카메라를 실제 카메라와 일치시킵니다.
4. Unity 캔버스는 투명 배경(`Plugins/WebGL/transparent_bg.jslib`)으로 렌더링되어 카메라 영상 위에 3D 오브젝트가 겹쳐 보입니다.

### 주요 스크립트
| 파일 | 역할 |
|---|---|
| `Scripts/WebAR/DetectionManager.cs` | JS에서 받은 마커 정보를 파싱해 `onMarkerDetected` / `onMarkerVisible` / `onMarkerLost` 이벤트 발행 (싱글톤) |
| `Scripts/WebAR/GenericController.cs` | 지정한 마커(`markerToListen`, 기본 `hiro`)를 따라 자식 오브젝트를 부드럽게 이동/회전, 마커를 잃으면 숨김 + 안내 UI 표시 |
| `Scripts/WebAR/MultiMarkerController.cs` | 여러 마커 중 보이는 것 아무거나 따라가는 컨트롤러 |
| `Scripts/Common/CameraController.cs` | JS에서 받은 projection/위치/회전을 Unity 카메라에 적용 |
| `Scripts/WebAR/UIHandler.cs`, `UIScaler.cs` | 브라우저 창 크기에 맞춰 UI 캔버스 크기 조정 |
| `Scripts/WebAR/MarkerGeneration/MarkerGenerator.cs` | **에디터 메뉴 `ARWT/MarkerGenerator`** — 이미지를 넣으면 AR.js용 `.patt` 마커 파일과 인쇄용 마커 이미지 생성 |
| `Scripts/WebAR/MarkerGeneration/TextureScaler.cs` | 마커 생성 시 GPU로 텍스처 리사이즈 (**Unity 2021 대응 수정**: `Resize` → `Reinitialize`) |
| `Scripts/WebAR/Editor/PrefabsHandler.cs` | 에디터에서 AR 프리팹을 씬에 추가하는 도우미 |

### 데모 씬 (`Assets/Demos/Marker`)
- **AR Marker Simple Button** — 마커 위에 모델 표시, UI 버튼을 누르면 Dissolve 셰이더로 사라졌다 나타나는 효과 (`DissolveController.cs`, `Dissolve.shader`)
- **AR Marker Rotate and Scale** — 마커 위 미니 하우스 모델을 한 손가락 드래그로 회전, 두 손가락 핀치로 확대/축소 (`InteractionsController.cs`, 최소 0.1 ~ 최대 3배)
- **AR Multiple Marker** — Hiro / Nutty / NuttyCardboard 등 여러 마커 동시 인식

---

## 2. WebXR — 마커리스 AR

### 동작 구조
1. `WebGLTemplates/WebXR/js/app.js`가 `navigator.xr.requestSession('immersive-ar', ...)`로 AR 세션을 엽니다.
   - 일반 모드: `requiredFeatures: ['local-floor', 'hit-test']`
   - 이미지 추적 모드: `requiredFeatures: ['local-floor', 'image-tracking']`
2. 매 XR 프레임마다 카메라 포즈, hit-test 결과, 추적 이미지 포즈를 Unity 좌표계로 변환(`quaternionToUnity`, `vec3ToUnity`)해 `SendMessage`로 전달합니다.
3. Unity 측 jslib(`Plugins/WebGL/webxr.jslib`, `webxr.jspre`)가 Unity ↔ JS 연결을 담당합니다.

### 주요 스크립트
| 파일 | 역할 |
|---|---|
| `Scripts/WebXR/WebXRManager.cs` | 세션 초기화, `imageTracking` 체크 시 이미지 추적 모드 활성화 |
| `Scripts/WebXR/WebXRButton.cs` | "AR 시작" 버튼 |
| `Scripts/WebXR/WebXRCamera.cs` + `Providers/WebXRCameraProvider.cs` | XR 카메라 포즈/투영 적용 |
| `Scripts/WebXR/HitListener.cs` + `Providers/WebXRHitProvider.cs` | 화면 탭 시 인식된 바닥/평면 위치에 프리팹 생성 |
| `Scripts/WebXR/ImageLibrary.cs` | **에셋 메뉴 `ARWT/ImageLibrary`** — 추적할 이미지와 실제 크기(width/height)를 등록하는 ScriptableObject |
| `Scripts/WebXR/ImageTrackingListener.cs` + `Providers/WebXRImageTrackignProvider.cs` | 이미지 이름별로 연결된 GameObject를 추적 위치에 표시 |
| `Scripts/WebXR/WebXRTransformController.cs` | JS에서 받은 위치/회전/보임 여부를 오브젝트에 적용하는 기본 클래스 |
| `Scripts/WebXR/WebXRBuildActions.cs` | 빌드 후 이미지 라이브러리를 템플릿에 복사하는 등 빌드 후처리 |

### 데모 씬 (`Assets/Demos/Markerless`)
- **AR Markerless HitTest** — 바닥을 인식하고 탭한 위치에 Nutty 모델 배치
- **AR Markerless Anchors** — 배치한 오브젝트를 앵커로 공간에 고정
- **AR Markerless ImageTracking / SingleImageTracking** — 이미지 1장을 인식해 그 위에 오브젝트 표시
- **AR Markerless ImageTracking / MultipleImageTracking** — 여러 이미지 동시 추적

---

## 3. 공통 유틸
| 파일 | 역할 |
|---|---|
| `Scripts/Common/Utils/Singleton.cs` | 제네릭 싱글톤 베이스 |
| `Scripts/Common/Utils/FPSDisplay.cs` | 화면에 FPS 표시 |
| `Scripts/Common/Others/Rotator.cs` | 오브젝트 자동 회전 |
| `Scripts/Common/PostBuild/PostBuildActions.cs` | WebGL 빌드 후처리 |
| `Assets/Shaders/ShadowDrawer.shader` | 투명 바닥에 그림자만 그리는 셰이더 (AR에서 오브젝트가 바닥에 놓인 느낌) |
| `Assets/Editor/UnityPackageExporter.cs` | `.unitypackage` 내보내기 도구 |

---

## 4. 원본 대비 변경 사항
- Unity 에디터 버전 **2021.3.36f1**로 업그레이드 (`ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`)
- `TextureScaler.cs`: 폐기된 `Texture2D.Resize` API를 `Texture2D.Reinitialize`로 교체해 2021 LTS에서 컴파일되도록 수정

---

## 5. 실행 방법
1. Unity Hub에서 **2021.3.36f1**로 프로젝트를 엽니다.
2. `File > Build Settings`에서 플랫폼을 **WebGL**로 전환합니다.
3. `Player Settings > Resolution and Presentation > WebGL Template`에서
   - 마커 데모 → **WebAR**
   - 마커리스 데모 → **WebXR**
   을 선택합니다.
4. 원하는 데모 씬을 빌드에 추가하고 빌드합니다.
5. 결과물을 **HTTPS** 서버에 올려 휴대폰으로 접속합니다 (카메라/WebXR은 HTTPS 필수).
   - WebAR: `Assets/Resources/Markers`의 Hiro 마커 등을 인쇄하거나 화면에 띄워 비춥니다.
   - WebXR: Android + Chrome + ARCore 지원 기기가 필요합니다.
