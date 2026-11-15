// Keep the WebGL canvas transparent so the camera video shows through:
// Unity clears alpha to 1 at the end of each frame with an alpha-only color mask; skip that clear.
var LibraryGLClear = {
  glClear: function (mask) {
    if (mask == 0x00004000) {
      var v = GLctx.getParameter(GLctx.COLOR_WRITEMASK);
      if (!v[0] && !v[1] && !v[2] && v[3]) return;
    }
    GLctx.clear(mask);
  }
};
mergeInto(LibraryManager.library, LibraryGLClear);
