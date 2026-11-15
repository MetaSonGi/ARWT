using System.Collections.Generic;
using ARWT.Core;
using ARWT.Marker;
using UnityEngine;

namespace SON{
    /// <summary>
    /// Follows any of the listed AR.js markers and tells the page when the marker is found / lost.
    /// Also supports a marker-free preview pose (sent from the page with ?preview).
    /// </summary>
    public class SonMarkerController : MonoBehaviour{
        public List<string> markers = new List<string>{ "son", "Hiro" };
        public GameObject content;
        public float followSpeed = 12f;
        public float lostDelay = 0.4f;   // seconds without a sighting before hiding

        bool visible;
        bool snapNext = true;
        float lastSeen = -10f;
        string currentMarker = "";

        void OnEnable(){
            DetectionManager.onMarkerVisible += OnVisible;
        }

        void OnDisable(){
            DetectionManager.onMarkerVisible -= OnVisible;
        }

        void Start(){
            if(content) content.SetActive(false);
        }

        void OnVisible(MarkerInfo m){
            if(!markers.Contains(m.name)) return;
            if(visible && m.name != currentMarker && Time.time - lastSeen < 0.1f) return; // stick to one marker

            lastSeen = Time.time;
            currentMarker = m.name;

            if(snapNext){
                transform.SetPositionAndRotation(m.position, m.rotation);
                snapNext = false;
            }else{
                float t = 1f - Mathf.Exp(-followSpeed * Time.deltaTime);
                transform.position = Vector3.Lerp(transform.position, m.position, t);
                transform.rotation = Quaternion.Slerp(transform.rotation, m.rotation, t);
            }
            transform.localScale = new Vector3(Mathf.Abs(m.scale.x), Mathf.Abs(m.scale.y), Mathf.Abs(m.scale.z));

            if(!visible){
                visible = true;
                if(content) content.SetActive(true);
                WebBridge.Call("sonEvent", "found:" + m.name);
            }
        }

        void Update(){
            if(visible && Time.time - lastSeen > lostDelay){
                visible = false;
                snapNext = true;
                if(content) content.SetActive(false);
                WebBridge.Call("sonEvent", "lost:" + currentMarker);
            }
        }
    }
}
