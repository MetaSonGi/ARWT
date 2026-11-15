using System.Runtime.InteropServices;

namespace ARWT.Core{
    /// <summary>Calls window[name](arg) on the hosting page (WebGL only).</summary>
    public static class WebBridge{
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        static extern void ARWT_Call(string name, string arg);
#endif
        public static void Call(string name, string arg = ""){
#if UNITY_WEBGL && !UNITY_EDITOR
            ARWT_Call(name, arg);
#else
            UnityEngine.Debug.Log($"[WebBridge] {name}({arg})");
#endif
        }
    }
}
