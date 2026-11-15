using System.Collections.Generic;
using System.IO;
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;
#endif

namespace ARWT.Core{
    public class PostBuildActions{
        #if UNITY_EDITOR

        const string markerPlaceholder = "--MARKERS--";
        static string projectMarkers = "Assets/Resources/Markers";
        static string projectMarkersImages = "Assets/Resources/Images";
        static string markersPath = "data/markers";
        static string markersImagesPath = "data/markersImages";
        static string index = "index.html";

        

        [PostProcessBuild]
        public static void OnPostProcessBuild(BuildTarget target, string targetPath){
            if(target != BuildTarget.WebGL) return;
            if(PlayerSettings.WebGL.template.Contains("WebAR")){
                // Unity 2020+ loader is wired in index.html via template variables;
                // here we only inject the AR.js <a-marker> tags and marker images.
                generateHTML(targetPath);
                copyImages(targetPath);
            }
        }

        static string getName(string p){
            string[] pieces = new string[1];
            if(p.Contains("/")){
                pieces = p.Split('/');
            }else if(p.Contains("\\")){
                pieces = p.Split('\\');
            }
            return pieces[pieces.Length-1]; 
        }

        static void generateHTML(string targetPath){
            string html = "";

            var info = new DirectoryInfo(projectMarkers);
            var fileInfo = info.GetFiles();
            var completeMarkersPath = Path.Combine(targetPath, markersPath);
            if(Directory.Exists(completeMarkersPath)){
                Directory.Delete(completeMarkersPath, true);
            }
            Directory.CreateDirectory(completeMarkersPath);

            foreach (var file in fileInfo){
                if(file.Extension == ".patt"){
                    FileUtil.CopyFileOrDirectory(file.FullName, Path.Combine(completeMarkersPath, file.Name));
                    var markerName = file.Name.Replace(file.Extension, "");
                    var markerUrl = markersPath + "/" + file.Name;
                    html += $"\t\t\t<a-marker type=\"pattern\" url=\"{markerUrl}\" markercontroller=\"name : {markerName}\"></a-marker>\n";
                }
            }

            replaceInFile(Path.Combine(targetPath, index), markerPlaceholder, html);
        }

        static void replaceInFile(string indexPath, string lookingFor, string replace){
            string[] lines = File.ReadAllLines(indexPath);
            List<string> newLines = new List<string>();
            foreach(var l in lines){
                if(l.Contains(lookingFor)){
                    newLines.Add(replace);
                }else{
                    newLines.Add(l);
                }
            }
            File.WriteAllLines(indexPath, newLines.ToArray());
        }

        static void copyImages(string targetPath){
            var info = new DirectoryInfo(projectMarkersImages);
            var fileInfo = info.GetFiles();
            var completeImagesPath = Path.Combine(targetPath, markersImagesPath);
            if(Directory.Exists(completeImagesPath)){
                Directory.Delete(completeImagesPath, true);
            }
            Directory.CreateDirectory(completeImagesPath);

            foreach (var file in fileInfo){
                if(file.Extension == ".jpg"){
                    FileUtil.CopyFileOrDirectory(file.FullName, Path.Combine(completeImagesPath, file.Name));
                }
            }
        }

        #endif
    }
}