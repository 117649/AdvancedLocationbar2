const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

function install() { }

function uninstall() { }

function loadIntoBrowserDocument(document) {
  if (document.createXULElement &&
    document.defaultView.location.origin + document.defaultView.location.pathname == "chrome://browser/content/browser.xhtml") {
    Services.scriptloader.loadSubScript("chrome://advancedlocationbar/content/advancedlocationbar.js", document.defaultView);
    Services.scriptloader.loadSubScript("chrome://advancedlocationbar/content/urlbar.js", document.defaultView);
  }
}

const documentObserver = { observe: loadIntoBrowserDocument };

function startup(data, reason) {
  Services.scriptloader.loadSubScript("chrome://advancedlocationbar/content/prefs.js", {}, 'UTF-8');

  const observers = Services.obs.enumerateObservers("chrome-document-loaded");
  while (observers.hasMoreElements()) {
    const observer = observers.getNext();
    try {
      if (Cu.getSandboxMetadata(Cu.getGlobalForObject(observer.wrappedJSObject))?.addonID == data.id) {
        Services.obs.removeObserver(observer, "chrome-document-loaded");
      }
    } catch { }
  }

  const enumerator = Services.wm.getEnumerator(null);
  while (enumerator.hasMoreElements()) {
    loadIntoBrowserDocument(enumerator.getNext().document);
  }

  Services.obs.addObserver(documentObserver, "chrome-document-loaded");

  AddonManager.getAddonByID(data.id).then(addon => {
    Services.prefs.getBoolPref("extensions.advancedlocationbar.hide_warning") ?
      addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED
      : addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_MISSING;
    }
  );
}

function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Services.obs.removeObserver(documentObserver, "chrome-document-loaded");
  const enumerator = Services.wm.getEnumerator(null);
  while (enumerator.hasMoreElements()) {
    const view = enumerator.getNext().document.querySelector(
      "advancedlocationbar, .advancedlocationbar"
    );
    if (view) {
      if (view.destroy) view.destroy();
      else view.plain = true;
      view.remove();
    }
  }
}
