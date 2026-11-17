using UnityEngine;

namespace SON{
    /// <summary>
    /// Recording helper: unityInstance.SendMessage("SonRecorder", "SetCaptureFps", "12") makes game time
    /// advance exactly 1/12 s per rendered frame (Time.captureDeltaTime), so frames grabbed slowly still
    /// play back smoothly. "0" restores real time.
    /// </summary>
    public class SonRecorder : MonoBehaviour{
        public void SetCaptureFps(string fps){
            float f = float.Parse(fps, System.Globalization.CultureInfo.InvariantCulture);
            Time.captureDeltaTime = f > 0 ? 1f / f : 0f;
        }
    }
}
