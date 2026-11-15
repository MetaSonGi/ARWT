// Unity -> page bridge (replaces the removed Application.ExternalCall).
mergeInto(LibraryManager.library, {
  ARWT_Call: function (namePtr, argPtr) {
    var name = UTF8ToString(namePtr);
    var arg = UTF8ToString(argPtr);
    if (typeof window[name] === "function") {
      try { window[name](arg); } catch (e) { console.error(e); }
    }
  }
});
