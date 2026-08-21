(function () {
    const userBranch = Services.prefs.getBranch("");
    const defaultBranch = Services.prefs.getDefaultBranch("");

    function pref(name, value) {
      let branch = userBranch;
      if (defaultBranch.getPrefType(name) == Components.interfaces.nsIPrefBranch.PREF_INVALID ||
        defaultBranch.prefHasUserValue(name)) {
        // Define missing prefs and preserve existing user values.
        branch = defaultBranch;
      }
  
      if (typeof value == "boolean") {
        branch.setBoolPref(name, value);
      } else if (typeof value == "number" && Number.isInteger(value)) {
        branch.setIntPref(name, value);
      }
    }
  
    pref("extensions.advancedlocationbar.copy_unescaped", true);
    pref("extensions.advancedlocationbar.linkify_on_keys", true);
    pref("extensions.advancedlocationbar.linkify_on_mouse_icon", true);
    pref("extensions.advancedlocationbar.linkify_on_mouse_top", false);
    pref("extensions.advancedlocationbar.linkify_on_mouse_bottom", false);
    pref("extensions.advancedlocationbar.scroll_on_mouse_wheel", false);
})()
