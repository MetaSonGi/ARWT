/* SON AR — page side of the ARWT bridge.
 * AR.js (A-Frame) tracks the marker and streams camera + marker poses to Unity with SendMessage.
 * Unity calls back into window.cameraReady / window.detectionManagerReady / window.sonEvent.
 */
(function () {
  "use strict";

  // ---------- examples ----------
  const MARKERS = {
    son1: { no: "1", name: "댄스", desc: "신나게 춤춰요" },
    son2: { no: "2", name: "스핀", desc: "춤추며 빙글빙글 돌아요" },
    son3: { no: "3", name: "점프", desc: "리듬에 맞춰 점프해요" },
    son4: { no: "4", name: "거인", desc: "커다랗게, 느릿느릿 춤춰요" }
  };
  const EXAMPLES = {
    dancer: { markers: ["son1"], title: "SON 1번 마커를 비춰주세요", body: "마커 위에 댄서가 나타나요. 버튼과 손가락으로 조작해 보세요." },
    multi: { markers: ["son1", "son2", "son3", "son4"], title: "SON 마커 1~4번을 비춰주세요", body: "마커마다 다른 동작을 해요. 여러 개를 함께 비춰도 돼요." },
    preview: { markers: ["son1", "son2", "son3", "son4"], preview: true }
  };
  const params = new URLSearchParams(location.search);
  const EX_ID = params.has("preview") ? "preview" : params.get("ex");
  const EX = EXAMPLES[EX_ID] || null;
  const PREVIEW = !!(EX && EX.preview);

  // Preview poses (Unity coords: camera at origin looking +Z, characters face the camera)
  const PREVIEW_X = { son1: -1.65, son2: -0.55, son3: 0.55, son4: 1.65 };
  const previewPose = (id) => `${id},true,${PREVIEW_X[id]},-0.75,4.2,0,0.9962,-0.0872,0,1,1,1`;

  let unityInstance = null;
  let isCameraReady = false;
  let isDetectionManagerReady = false;
  const found = new Set();
  let active = EX ? EX.markers[0] : "son1";
  const danceState = {};

  const $ = (id) => document.getElementById(id);
  const unityCanvas = $("unity-canvas");

  function send(obj, method, arg) {
    if (!unityInstance) return;
    if (arg === undefined) unityInstance.SendMessage(obj, method);
    else unityInstance.SendMessage(obj, method, arg);
  }
  const charObj = (id) => "SonCharacter_" + id;

  // ---------- Unity -> page ----------
  window.cameraReady = () => { isCameraReady = true; };
  window.detectionManagerReady = () => { isDetectionManagerReady = true; };
  window.sonEvent = (msg) => {
    const [type, value, id] = msg.split(":");
    switch (type) {
      case "found":
        found.add(value);
        if (!found.has(active)) select(value);
        if (!PREVIEW && found.size === 1) toast(`${MARKERS[value].no}번 · ${MARKERS[value].name}`);
        refreshFound();
        break;
      case "lost":
        found.delete(value);
        if (active === value && found.size) select([...found][0]);
        refreshFound();
        break;
      case "dance":
        danceState[id] = value === "on";
        if (id === active) refreshDanceButton();
        toast(value === "on" ? "다시 춤춰요" : "잠깐 멈춤");
        break;
      case "color": if (id === active) $("swatch").style.setProperty("background", "#" + value, "important"); break;
    }
  };

  // ---------- UI ----------
  function setStatus(kind, text) {
    const el = $("status");
    el.className = "status status--" + kind;
    el.querySelector("span").textContent = text;
  }

  function select(id) {
    active = id;
    send(charObj(id), "Select");
    refreshDanceButton();
    refreshFound();
  }

  function refreshDanceButton() {
    const on = danceState[active] !== false;
    $("btn-dance").innerHTML = on ? "<span>⏸</span>멈춤" : "<span>▶</span>춤";
  }

  function refreshFound() {
    const n = found.size;
    if (PREVIEW) setStatus("preview", "미리보기");
    else if (n) setStatus("found", n === 1 ? `${MARKERS[[...found][0]].no}번 감지됨` : `마커 ${n}개 감지됨`);
    else setStatus("search", "마커를 찾는 중");

    const multi = EX && EX.markers.length > 1;
    const bar = $("found");
    bar.innerHTML = "";
    if (multi) {
      EX.markers.filter((m) => found.has(m)).forEach((m) => {
        const b = document.createElement("button");
        b.className = "found-chip" + (m === active ? " active" : "");
        b.innerHTML = `<b>${MARKERS[m].no}</b>${MARKERS[m].name}`;
        b.title = MARKERS[m].desc;
        b.addEventListener("click", () => select(m));
        bar.appendChild(b);
      });
    }
    bar.classList.toggle("show", multi && n > 0);
    showControls(n > 0);
  }

  function showControls(on) {
    $("dock").classList.toggle("show", on);
    $("gesture").classList.toggle("show", on);
    $("hint").classList.toggle("hidden", on);
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
  }

  document.querySelectorAll("#dock button").forEach((b) => {
    b.addEventListener("click", () => {
      send(charObj(active), b.dataset.call);
      if (navigator.vibrate) navigator.vibrate(12);
    });
  });

  // ---------- AR.js components ----------
  function createUnityMatrix(el) {
    const m = el.matrix.clone();
    const zFlipped = new THREE.Matrix4().makeScale(1, 1, -1).multiply(m);
    return zFlipped.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  }

  AFRAME.registerComponent("markercontroller", {
    schema: { name: { type: "string" } },
    tock: function () {
      if (!isDetectionManagerReady) return;
      const p = new THREE.Vector3(), r = new THREE.Quaternion(), s = new THREE.Vector3();
      createUnityMatrix(this.el.object3D).decompose(p, r, s);
      send("DetectionManager", "markerInfos",
        `${this.data.name.trim()},${this.el.object3D.visible},${p.toArray()},${r.toArray()},${s.toArray()}`);
    }
  });

  AFRAME.registerComponent("cameratransform", {
    tock: function () {
      if (!isCameraReady) return;
      const t = new THREE.Vector3(), r = new THREE.Quaternion(), s = new THREE.Vector3();
      this.el.object3D.matrix.clone().decompose(t, r, s);
      const proj = this.el.components.camera.camera.projectionMatrix;
      send("Main Camera", "setProjection", `${[...proj.elements]}`);
      send("Main Camera", "setPosition", `${t.toArray()}`);
      send("Main Camera", "setRotation", `${r.toArray()}`);
      send("Canvas", "setSize", `${unityCanvas.width},${unityCanvas.height}`);
    }
  });

  // Keep the Unity canvas exactly over the AR.js canvas so projections line up.
  AFRAME.registerComponent("copycanvas", {
    tick: function () {
      const r = this.el.canvas.getBoundingClientRect();
      const st = unityCanvas.style;
      st.inset = "auto";
      st.left = r.left + "px";
      st.top = r.top + "px";
      st.width = r.width + "px";
      st.height = r.height + "px";
    }
  });

  // ---------- preview (no camera / no marker) ----------
  function previewLoop() {
    if (isCameraReady) {
      send("Main Camera", "setPosition", "0,0,0");
      send("Main Camera", "setRotation", "0,0,0,1");
    }
    if (isDetectionManagerReady) EX.markers.forEach((m) => send("DetectionManager", "markerInfos", previewPose(m)));
    requestAnimationFrame(previewLoop);
  }

  // ---------- boot ----------
  function startAR() {
    if (PREVIEW) {
      document.body.classList.add("preview");
      setStatus("preview", "미리보기");
      $("hint").classList.add("hidden");
      requestAnimationFrame(previewLoop);
      return;
    }
    checkCamera().then((ok) => {
      if (!ok) return;
      const tpl = $("ar-scene");
      const frag = tpl.content.cloneNode(true);
      frag.querySelectorAll("a-marker").forEach((m) => {
        const name = (m.getAttribute("markercontroller") || "").split(":").pop().trim();
        if (!EX.markers.includes(name)) m.remove();
      });
      document.body.insertBefore(frag, tpl);
    });
  }

  // Ask for the camera ourselves first so we can explain failures instead of AR.js's bare alert().
  const CAMERA_ERRORS = {
    NotAllowedError: ["카메라 권한이 막혀 있어요", "주소창의 🔒(사이트 설정)에서 카메라를 '허용'으로 바꾼 뒤 다시 시도하세요."],
    SecurityError: ["카메라 권한이 막혀 있어요", "주소창의 🔒(사이트 설정)에서 카메라를 '허용'으로 바꾼 뒤 다시 시도하세요."],
    NotReadableError: ["다른 앱이 카메라를 쓰고 있어요", "Zoom·Teams·카메라 앱 등을 닫고 다시 시도하세요."],
    NotFoundError: ["카메라를 찾을 수 없어요", "웹캠이 연결돼 있는지 확인하세요. 카메라가 없으면 '마커 없이 보기'로 볼 수 있어요."],
    OverconstrainedError: ["카메라 설정을 맞출 수 없어요", "다른 카메라나 브라우저로 시도해 보세요."],
    NoMediaDevices: ["이 브라우저는 카메라를 열 수 없어요", "카카오톡·인스타 같은 앱 안 브라우저나 미리보기 창이면, Chrome이나 Safari로 이 주소를 직접 열어주세요."]
  };

  async function checkCamera() {
    let name = "NoMediaDevices";
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        stream.getTracks().forEach((t) => t.stop());
        $("camera-error").classList.remove("show");
        return true;
      } catch (e) {
        name = e && e.name in CAMERA_ERRORS ? e.name : "NotAllowedError";
        console.warn("camera:", e);
      }
    }
    const [title, body] = CAMERA_ERRORS[name];
    $("camera-error-title").textContent = title;
    $("camera-error-body").textContent = body;
    $("camera-error").classList.add("show");
    $("hint").classList.add("hidden");
    setStatus("error", "카메라 꺼짐");
    return false;
  }

  $("camera-retry").addEventListener("click", () => startAR());

  function loadUnity() {
    const cfg = Object.assign({}, window.SON_BUILD, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      webglContextAttributes: { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false },
      showBanner: (msg, type) => { if (type === "error") { console.error(msg); toast("오류: " + msg); } else console.warn(msg); }
    });
    const script = document.createElement("script");
    script.src = cfg.loaderUrl;
    script.onload = () => {
      createUnityInstance(unityCanvas, cfg, (p) => {
        const pct = Math.round(p * 100);
        $("loader-fill").style.width = pct + "%";
        $("loader-text").textContent = "불러오는 중 " + pct + "%";
      }).then((instance) => {
        unityInstance = instance;
        window.sonUnity = instance;  // handy for debugging / recording from the console
        $("loader").classList.add("done");
        startAR();
      }).catch((e) => {
        $("loader-text").textContent = "불러오기 실패: " + e;
      });
    };
    document.body.appendChild(script);
  }

  if (!EX) {
    // gallery: nothing heavy is loaded until an example is chosen
    document.body.classList.add("is-home");
    $("loader").classList.add("done");
  } else {
    document.body.classList.add("ex-" + EX_ID);
    if (!PREVIEW) {
      $("hint-title").textContent = EX.title;
      $("hint-body").textContent = EX.body;
      $("hint-img").src = "marker/" + EX.markers[0] + ".png";
    }
    loadUnity();
  }
})();
