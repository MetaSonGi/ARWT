using System.IO;
using ARWT.Marker;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace SON.EditorTools{
    /// <summary>
    /// Builds the "SON AR" scene from the ARWT marker demo and produces the WebGL build.
    /// Menu: SON/Create Scene, SON/Build WebGL
    /// Batch: Unity -batchmode -quit -projectPath . -executeMethod SON.EditorTools.SonBuild.BuildWebGL
    /// </summary>
    public static class SonBuild{
        const string SourceScene = "Assets/Demos/Marker/AR Marker Simple Button/ARMarker Simple Button.unity";
        const string ScenePath = "Assets/SON/SON AR.unity";
        const string CharacterFbx = "Assets/Character/Flair.fbx";
        const string CharacterController = "Assets/Character/Animations/Character.controller";
        const string ShadowMaterial = "Assets/Materials/ShadowDrawer.mat";
        const string OutputDir = "Builds/WebGL";
        const float TargetHeight = 0.9f; // character height in marker units

        [MenuItem("SON/Create Scene")]
        public static void CreateScene(){
            AssetDatabase.DeleteAsset(ScenePath);
            if(!AssetDatabase.CopyAsset(SourceScene, ScenePath)) throw new System.Exception("Could not copy " + SourceScene);
            var scene = EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            var generic = Object.FindAnyObjectByType<GenericController>(FindObjectsInactive.Include);
            if(generic == null) throw new System.Exception("GenericController not found in demo scene");
            var root = generic.gameObject;

            // Old robot content and Unity-side UI are replaced by the SON character + HTML UI.
            if(generic.child) generic.child.SetActive(false);
            if(generic.uiHelper) generic.uiHelper.SetActive(false);
            if(generic.gameUI) generic.gameUI.SetActive(false);
            Object.DestroyImmediate(generic);

            var content = new GameObject("SonContent");
            content.transform.SetParent(root.transform, false);

            var shadow = GameObject.CreatePrimitive(PrimitiveType.Quad);
            shadow.name = "SonShadow";
            Object.DestroyImmediate(shadow.GetComponent<Collider>());
            shadow.transform.SetParent(content.transform, false);
            shadow.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            shadow.transform.localScale = Vector3.one * 3f;
            var shadowMat = AssetDatabase.LoadAssetAtPath<Material>(ShadowMaterial);
            if(shadowMat) shadow.GetComponent<Renderer>().sharedMaterial = shadowMat;

            var character = new GameObject("SonCharacter");       // name is the SendMessage target
            character.transform.SetParent(content.transform, false);
            var model = new GameObject("Model");
            model.transform.SetParent(character.transform, false);

            var fbx = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterFbx);
            var flair = (GameObject)PrefabUtility.InstantiatePrefab(fbx);
            flair.transform.SetParent(model.transform, false);

            var animator = flair.GetComponent<Animator>();   // Unity fake-null: no ?? here
            if(animator == null) animator = flair.AddComponent<Animator>();
            animator.runtimeAnimatorController = AssetDatabase.LoadAssetAtPath<AnimatorController>(CharacterController);
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;

            float height = 1.8f;
            var renderers = flair.GetComponentsInChildren<Renderer>();
            if(renderers.Length > 0){
                var b = renderers[0].bounds;
                foreach(var r in renderers) b.Encapsulate(r.bounds);
                if(b.size.y > 0.01f) height = b.size.y;
            }

            var son = character.AddComponent<SonCharacter>();
            son.animator = animator;
            son.model = model.transform;
            son.baseScale = TargetHeight / height;
            model.transform.localScale = Vector3.one * son.baseScale;

            var follower = root.AddComponent<SonMarkerController>();
            follower.content = content;
            root.name = "SonMarker";

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Debug.Log($"[SON] Scene created at {ScenePath} (character height {height:F2}, baseScale {son.baseScale:F3})");
        }

        [MenuItem("SON/Build WebGL")]
        public static void BuildWebGL(){
            CreateScene();

            PlayerSettings.productName = "SON AR";
            PlayerSettings.companyName = "SON";
            PlayerSettings.WebGL.template = "PROJECT:WebAR";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled; // GitHub Pages has no gzip/brotli headers
            PlayerSettings.WebGL.decompressionFallback = false;
            PlayerSettings.WebGL.nameFilesAsHashes = false;
            PlayerSettings.WebGL.dataCaching = true;
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL);

            if(Directory.Exists(OutputDir)) Directory.Delete(OutputDir, true);
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions{
                scenes = new[]{ ScenePath },
                locationPathName = OutputDir,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            });
            Debug.Log($"[SON] Build result: {report.summary.result}, size {report.summary.totalSize / 1048576f:F1} MB");
            if(Application.isBatchMode) EditorApplication.Exit(report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
        }
    }
}
