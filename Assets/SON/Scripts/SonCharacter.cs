using System.Collections;
using ARWT.Core;
using UnityEngine;

namespace SON{
    /// <summary>
    /// SON character interactions. Public methods are called from the page with
    /// unityInstance.SendMessage("SonCharacter", "&lt;Method&gt;").
    /// One-finger drag rotates, two-finger pinch scales (touch or mouse drag / wheel).
    /// </summary>
    public enum SonMode{ Dance, Spin, Jump, Giant }

    public class SonCharacter : MonoBehaviour{
        [Tooltip("Marker id this character belongs to, e.g. son1")]
        public string id = "son1";
        public SonMode mode = SonMode.Dance;
        public Color startColor = Color.white;
        public Animator animator;
        public Transform model;          // the visual that gets spun / hopped / scaled
        public float baseScale = 0.6f;
        public float minScale = 0.2f, maxScale = 2.5f;
        public float dragDegreesPerPixel = 0.4f;

        static readonly Color[] Palette = {
            Color.white,
            new Color(1f, 0.36f, 0.21f),   // SON orange
            new Color(0.36f, 0.62f, 1f),
            new Color(0.55f, 1f, 0.55f),
            new Color(1f, 0.85f, 0.3f),
            new Color(0.85f, 0.45f, 1f),
        };

        float scaleFactor = 1f;
        float jumpTimer;
        int colorIndex = -1;
        bool dancing = true;
        bool busy;
        float pinchStart;
        float scaleAtPinch;
        Renderer[] renderers;
        MaterialPropertyBlock block;

        void Awake(){
            renderers = GetComponentsInChildren<Renderer>(true);
            block = new MaterialPropertyBlock();
            if(mode == SonMode.Giant) scaleFactor = 1.7f;
            if(animator && mode == SonMode.Giant) animator.speed = 0.5f;
            Tint(startColor);
            ApplyScale();
        }

        void Start(){
            WebBridge.Call("sonEvent", "ready::" + id);
        }

        /// <summary>Character that receives drag / pinch. Set by the page (Select) or on first sighting.</summary>
        public static SonCharacter selected;
        public void Select(){ selected = this; WebBridge.Call("sonEvent", "selected::" + id); }
        bool Controllable => selected == null || selected == this;

        float DanceSpeed => mode == SonMode.Giant ? 0.5f : 1f;

        // ---------- page buttons ----------
        public void ToggleDance(){
            dancing = !dancing;
            if(animator) animator.speed = dancing ? DanceSpeed : 0f;
            WebBridge.Call("sonEvent", (dancing ? "dance:on:" : "dance:off:") + id);
        }

        public void Spin(){ if(!busy) StartCoroutine(SpinRoutine()); }
        public void Jump(){ if(!busy) StartCoroutine(JumpRoutine()); }
        public void ScaleUp(){ scaleFactor = Mathf.Clamp(scaleFactor * 1.2f, minScale, maxScale); ApplyScale(); }
        public void ScaleDown(){ scaleFactor = Mathf.Clamp(scaleFactor / 1.2f, minScale, maxScale); ApplyScale(); }

        public void NextColor(){
            colorIndex = (colorIndex + 1) % Palette.Length;
            Color c = Palette[colorIndex];
            Tint(c);
            WebBridge.Call("sonEvent", "color:" + ColorUtility.ToHtmlStringRGB(c) + ":" + id);
        }

        void Tint(Color c){
            foreach(var r in renderers){
                r.GetPropertyBlock(block);
                block.SetColor("_Color", c);
                block.SetColor("_BaseColor", c);
                r.SetPropertyBlock(block);
            }
        }

        public void ResetPose(){
            scaleFactor = 1f;
            ApplyScale();
            model.localRotation = Quaternion.identity;
        }

        // ---------- per-marker behavior + touch / mouse ----------
        void Update(){
            if(dancing && !busy){
                if(mode == SonMode.Spin) model.Rotate(0f, 120f * Time.deltaTime, 0f, Space.Self);
                if(mode == SonMode.Jump && (jumpTimer += Time.deltaTime) > 1.3f){ jumpTimer = 0f; Jump(); }
            }

            if(!Controllable) return;
            if(Input.touchCount == 1){
                var t = Input.GetTouch(0);
                if(t.phase == TouchPhase.Moved) model.Rotate(0f, -t.deltaPosition.x * dragDegreesPerPixel, 0f, Space.Self);
            }else if(Input.touchCount == 2){
                var d = Vector2.Distance(Input.GetTouch(0).position, Input.GetTouch(1).position);
                if(Input.GetTouch(1).phase == TouchPhase.Began){ pinchStart = d; scaleAtPinch = scaleFactor; }
                else if(pinchStart > 1f){ scaleFactor = Mathf.Clamp(scaleAtPinch * d / pinchStart, minScale, maxScale); ApplyScale(); }
            }else if(Input.GetMouseButton(0) && Input.touchCount == 0){
                model.Rotate(0f, -Input.GetAxis("Mouse X") * 8f, 0f, Space.Self);
            }

            float wheel = Input.mouseScrollDelta.y;
            if(Mathf.Abs(wheel) > 0.01f){
                scaleFactor = Mathf.Clamp(scaleFactor * (1f + wheel * 0.1f), minScale, maxScale);
                ApplyScale();
            }
        }

        void ApplyScale(){
            if(model) model.localScale = Vector3.one * baseScale * scaleFactor;
        }

        IEnumerator SpinRoutine(){
            busy = true;
            Quaternion start = model.localRotation;
            for(float t = 0; t < 1f; t += Time.deltaTime / 0.7f){
                float e = 1f - Mathf.Pow(1f - t, 3f);
                model.localRotation = start * Quaternion.Euler(0f, 360f * e, 0f);
                yield return null;
            }
            model.localRotation = start;
            busy = false;
        }

        IEnumerator JumpRoutine(){
            busy = true;
            Vector3 start = model.localPosition;
            for(float t = 0; t < 1f; t += Time.deltaTime / 0.6f){
                float h = 4f * t * (1f - t);                       // parabola 0 -> 1 -> 0
                float squash = 1f + 0.15f * Mathf.Sin(t * Mathf.PI * 2f);
                model.localPosition = start + Vector3.up * h * 0.5f;
                model.localScale = new Vector3(1f / Mathf.Sqrt(squash), squash, 1f / Mathf.Sqrt(squash)) * baseScale * scaleFactor;
                yield return null;
            }
            model.localPosition = start;
            ApplyScale();
            busy = false;
        }
    }
}
