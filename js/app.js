/* SON AR — page side of the ARWT bridge.
 * AR.js (A-Frame) tracks the marker and streams camera + marker poses to Unity with SendMessage.
 * Unity calls back into window.cameraReady / window.detectionManagerReady / window.sonEvent.
 */
(function () {
  "use strict";

  const PREVIEW = new URLSearchParams(location.search).has("preview");
  // Marker pose used by ?preview (Unity coords: camera at origin looking +Z)
  const PREVIEW_POSE = "son,true,0,-0.5,2.4,0,0.9962,-0.0872,0,1,1,1";

  let unityInstance = null;
  let isCameraReady = false;
  let isDetectionManagerReady = false;
  let dancing = true;

  const $ = (id) => document.getElementById(id);
  const unityCanvas = $("unity-canvas");

  function send(obj, method, arg) {
    if (!unityInstance) return;
    if (arg === undefined) unityInstance.SendMessage(obj, method);
    else unityInstance.SendMessage(obj, method, arg);
  }

  // ---------- Unity -> page ----------
  window.cameraReady = () => { isCameraReady = true; };
  window.detectionManagerReady = () => { isDetectionManagerReady = true; };
  window.sonEvent = (msg) => {
    const [type, value] = msg.split(":");
    switch (type) {
      case "found": setStatus(PREVIEW ? "preview" : "found", PREVIEW ? "미리보기" : "SON 감지됨"); showControls(true); break;
      case "lost": if (!PREVIEW) { setStatus("search", "마커를 찾는 중"); showControls(false); } break;
      case "dance":
        dancing = value === "on";
        $("btn-dance").innerHTML = dancing ? "<span>⏸</span>멈춤" : "<span>▶</span>춤";
        toast(dancing ? "다시 춤춰요" : "잠깐 멈춤");
        break;
      case "color": $("swatch").style.setProperty("background", "#" + msg.split("#")[1], "important"); break;
    }
  };

  // ---------- UI ----------
  function setStatus(kind, text) {
    const el = $("status");
    el.className = "status status--" + kind;
    el.querySelector("span").textContent = text;
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
      send("SonCharacter", b.dataset.call);
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
    if (isDetectionManagerReady) send("DetectionManager", "markerInfos", PREVIEW_POSE);
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
    const tpl = $("ar-scene");
    document.body.insertBefore(tpl.content.cloneNode(true), tpl);
  }

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
        $("loader").classList.add("done");
        startAR();
      }).catch((e) => {
        $("loader-text").textContent = "불러오기 실패: " + e;
      });
    };
    document.body.appendChild(script);
  }

  loadUnity();
})();
