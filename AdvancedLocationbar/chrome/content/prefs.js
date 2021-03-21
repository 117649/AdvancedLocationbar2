(function () {
    function pref(name, value) {
      let branch = Services.prefs.getBranch("");
      let defaultBranch = Services.prefs.getDefaultBranch("");
      if (defaultBranch.getPrefType(name) == Components.interfaces.nsIPrefBranch.PREF_INVALID) {
        // Only use the default branch if it doesn't already have the pref set.
        // If there is already a pref with this value on the default branch, the
        // extension wants to override a built-in value.
        branch = defaultBranch;
      } else if (defaultBranch.prefHasUserValue(name)) {
        // If a pref already has a user-set value it proper type
        // will be returned (not PREF_INVALID). In that case keep the user's
        // value and overwrite the default.
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

})()