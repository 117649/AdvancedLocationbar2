/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{

class AdvUrlbar extends MozXULElement {
  static get markup() {
    return `
    <hbox class="autocomplete-textbox-container urlbar-textbox-container" flex="1">
      <stack flex="1">
        <children includes="progressmeter"></children>
        <hbox class="autocomplete-textbox-container-fission">
          <hbox class="textbox-icon-box" onmouseover="gURLBar._enterLinkifyMode();">
            <children includes="image|deck|stack|box">
              <image class="autocomplete-icon" allowevents="true"></image>
            </children>
          </hbox>
          <stack flex="1" anonid="textbox-input-box" class="textbox-input-box urlbar-input-box">
            <hbox anonid="textbox-input-box-inner" inherits="tooltiptext=inputtooltiptext" flex="1" align="center">
              <children></children>
              <html:input anonid="input" class="autocomplete-textbox urlbar-input textbox-input uri-element-right-align" flex="1" allowevents="true" inherits="tooltiptext=inputtooltiptext,onfocus,onblur,value,type,maxlength,disabled,size,readonly,placeholder,userAction"></html:input>
            </hbox>
            <hbox anonid="presentation-box" class="textbox-presentation-box" flex="1" align="center" onmousedown="gURLBar.focus();" ondragover="nsDragAndDrop.dragOver(event, gURLBar);" ondrop="nsDragAndDrop.drop(event, gURLBar);" ondragexit="nsDragAndDrop.dragExit(event, gURLBar);">
              <scrollbox anonid="presentation" class="textbox-presentation" flex="1">
                <hbox is="segment" anonid="prePathSub" class="textbox-presentation-segment textbox-presentation-prePathSub">
                  <label anonid="protocol" class="textbox-presentation-protocol"></label>
                  <label anonid="subdomain" class="textbox-presentation-subdomain"></label>
                </hbox>
                <hbox is="segment" anonid="prePath" class="textbox-presentation-segment textbox-presentation-prePath">
                  <label anonid="domain" class="textbox-presentation-domain"></label>
                  <label anonid="port" class="textbox-presentation-port"></label>
                </hbox>
                <hbox is="file-segment" anonid="pathFile" class="textbox-presentation-segment textbox-presentation-pathFile">
                  <label anonid="file" class="textbox-presentation-file"></label>
                </hbox>
                <hbox is="file-segment" anonid="pathFileQ" class="textbox-presentation-segment textbox-presentation-pathFile">
                  <label anonid="query" class="textbox-presentation-query"></label>
                </hbox>
                <hbox is="file-segment" anonid="pathFileF" class="textbox-presentation-segment textbox-presentation-pathFile">
                  <label anonid="fragment" class="textbox-presentation-fragment"></label>
                </hbox>
              </scrollbox>
              <label anonid="overflow-ellipsis" class="textbox-overflow-ellipsis" hidden="true"></label>
            </hbox>
          </stack>
          <children includes="hbox"></children>
        </hbox>
      </stack>
    </hbox>
    <dropmarker anonid="historydropmarker" class="autocomplete-history-dropmarker urlbar-history-dropmarker" allowevents="true" inherits="open,enablehistory,parentfocused=focused"></dropmarker>
    <children includes="toolbarbutton"></children>
    <popupset anonid="popupset" class="autocomplete-result-popupset"></popupset>
  `;
  }

  constructor() {
    super();

    this.addEventListener("input", (event) => { this._syncValue(); });

    this.addEventListener("mouseover", (event) => {
      if (this._mouseover)
        return;
      if (!this.plain) {
        var bO = this.inputBox.boxObject;
        if (event.screenX < bO.screenX || event.screenX > bO.screenX + bO.width)
          return;
      }
      this._mouseover = true;
      var bO = this.boxObject;
      if (this.linkify_on_mouse_icon && this._iconWasHovered || this.linkify_on_keys && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) ||
        this.linkify_on_mouse_top && event.screenY < bO.screenY + bO.height / 4 ||
        this.linkify_on_mouse_bottom && event.screenY >= bO.screenY + bO.height / 4)
        this.setAttribute("linkify", "true");
      else
        setTimeout(function(self) {
          if (self._mouseover && self.getAttribute("linkify") != "true") {
            self.formatValue();
            self.plain = true;
            document.addEventListener("keydown", self, false);
          }
        }, 50, this);
    });

    this.addEventListener("mouseout", (event) => {
      for (var node = event.relatedTarget; node; node = node.parentNode)
        if (node == this)
          return;
      this.removeAttribute("linkify");
      this._mouseover = false;
      if (!this._focused && this.plain) {
        this.prettyView();
        document.removeEventListener("keydown", this, false);
      } else
        this._hideURLTooltip();
    });

    this.addEventListener("focus", (event) => {
      if (!this._focused && event.originalTarget == this.inputField) {
        this._focused = true;
        this._justFocusedFromPretty = true;
        if (!this.plain)
          this.plain = true;
      }
    }, true);

    this.addEventListener("blur", (event) => {
      if (this._focused && event.originalTarget == this.inputField) {
        this._focused = false;
        this._syncValue();
        if (!this._mouseover)
          this.prettyView();
      }
    }, true);

  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    this.textContent = "";
    this.appendChild(this.constructor.fragment);
    // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

    this.copy_unescaped = this._prefsext.getBoolPref("copy_unescaped");

    this.linkify_on_keys = this._prefsext.getBoolPref("linkify_on_keys");

    this.linkify_on_mouse_icon = this._prefsext.getBoolPref("linkify_on_mouse_icon");

    this.linkify_on_mouse_top = this._prefsext.getBoolPref("linkify_on_mouse_top");

    this.linkify_on_mouse_bottom = this._prefsext.getBoolPref("linkify_on_mouse_bottom");

    this.uri = "";

    this._focused = "";

    this._justFocusedFromPretty = "";

    this._mouseover = "";

    this._iconWasHovered = "";

    this._iconWasHoveredOutTime = "";

    var node = document.createElement("label", {is: 'single-segment'});
    node.className = "textbox-presentation-segment textbox-presentation-path";
    
    this.pathSegmentProto = node;

    this.inputBox = document.getAnonymousElementByAttribute(this, "anonid", "textbox-input-box");

    this.inputBoxInner = document.getAnonymousElementByAttribute(this, "anonid", "textbox-input-box-inner");

    this.presentationBox = document.getAnonymousElementByAttribute(this, "anonid", "presentation-box");

    this.presentation = document.getAnonymousElementByAttribute(this, "anonid", "presentation");

    this.overflowEllipsis = document.getAnonymousElementByAttribute(this, "anonid", "overflow-ellipsis");

    this.prePathSubNode = document.getAnonymousElementByAttribute(this, "anonid", "prePathSub");

    this.prePathNode = document.getAnonymousElementByAttribute(this, "anonid", "prePath");

    this.protocolNode = document.getAnonymousElementByAttribute(this, "anonid", "protocol");

    this.subDomainNode = document.getAnonymousElementByAttribute(this, "anonid", "subdomain");

    this.domainNode = document.getAnonymousElementByAttribute(this, "anonid", "domain");

    this.portNode = document.getAnonymousElementByAttribute(this, "anonid", "port");

    this.pathFileNode = document.getAnonymousElementByAttribute(this, "anonid", "pathFile");

    this.pathFileNodeQ = document.getAnonymousElementByAttribute(this, "anonid", "pathFileQ");

    this.pathFileNodeF = document.getAnonymousElementByAttribute(this, "anonid", "pathFileF");

    this.fileNode = document.getAnonymousElementByAttribute(this, "anonid", "file");

    this.queryNode = document.getAnonymousElementByAttribute(this, "anonid", "query");

    this.fragmentNode = document.getAnonymousElementByAttribute(this, "anonid", "fragment");

    this._tldService = Components.classes["@mozilla.org/network/effective-tld-service;1"]
      .getService(Components.interfaces.nsIEffectiveTLDService);

    this._idnService = Components.classes["@mozilla.org/network/idn-service;1"]
      .getService(Components.interfaces.nsIIDNService);

    this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
      .getService(Components.interfaces.nsIIOService);

    this._plain = true;

    try {
      this.overflowEllipsis.value =
        Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch)
        .getComplexValue("intl.ellipsis",
          Components.interfaces.nsIPrefLocalizedString)
        .data;
    } catch (ex) {
      this.overflowEllipsis.value = "\u2026";
    }

    this._prefsext = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefService)
      .getBranch("extensions.advancedlocationbar.");

    this._prefsext.addObserver("", this, false);

    // Focus hack, I haven't investigated why it's needed
    let self = this;
    this.inputField.addEventListener("focus", function() {
      if (!self._justFocusedFromPretty)
        return;
      self._justFocusedFromPretty = false;
      setTimeout(function() {
        self.inputField.focus();
      });
    }, false);

    this.inputBoxInner.focus = function() {
      self.inputField.focus();
    };

    this.plain = true;

  }

  set plain(val) {
    this._plain = val;
    if (val) {
      this.inputBoxInner.style.removeProperty("opacity");
      this.presentationBox.hidden = true;
    } else
      this.inputBoxInner.style.setProperty("opacity", "0", "important");
    this.presentationBox.style.removeProperty("opacity");
    this._hideURLTooltip();
    return val;
  }

  get plain() {
    return this._plain
  }

  set _formattingEnabled(val) {
    if (val) this.presentationBox.classList.remove('no-format-on-hover');
    else this.presentationBox.classList.add('no-format-on-hover');
    return val;
  }

  get _formattingEnabled() {
    return !this.presentationBox.classList.contains('no-format-on-hover');
  }

  set _contentIsCropped(val) {
    this.overflowEllipsis.hidden = !val;
    return val;
  }

  get _contentIsCropped() {
    return !this.overflowEllipsis.hidden;
  }

  set value(val) {
    this.mIgnoreInput = true;

    if (typeof this.onBeforeValueSet == "function")
      val = this.onBeforeValueSet(val);

    if (typeof this.trimValue == "function" && this._mayTrimURLs)
      val = this.trimValue(val);
    this.valueIsTyped = false;

    if (!this.inputField.value) {
      this._contentIsCropped = false;
    }

    if (val) {
      // clear the emptyText _before_ setting a new non-empty value
      if (this._clearEmptyText)
        this._clearEmptyText();
      this.inputField.value = val;
    } else {
      // display the emptyText _after_ setting a value that's an empty string
      this.inputField.value = val;
      if (this._updateVisibleText)
        this._updateVisibleText();
    }
    this.mIgnoreInput = false;
    this._syncValue();
    if (this._focused)
      this.plain = true;
    else if (!this._mouseover || !this.plain)
      this.prettyView();
    var event = document.createEvent("Events");
    event.initEvent("ValueChange", true, true);
    this.inputField.dispatchEvent(event);
    return val;
  }

  get value() {
    if (typeof this.onBeforeValueGet == "function") {
      var result = this.onBeforeValueGet();
      if (result)
        return result.value;
    }
    return (this.hasAttribute('isempty') || this.hasAttribute('empty')) ? '' : this.inputField.value;
  }

  _syncValue() {
    var missingProtocol = false;
    if (this.value == "")
      this.uri = null;
    else try {
      var val = this.value;
      if (this._mayTrimURLs && !/^[a-z]*:/.test(this.value)) {
        val = "http://" + val;
        missingProtocol = true;
      }
      var uri = this._ioService.newURI(val, null, null);
      this.uri = (typeof uri.host != "undefined") ? uri : null;
    } catch (e) {
      this.uri = null;
      missingProtocol = false;
    }
    if (!this.uri) {
      this._contentIsCropped = false;
      return;
    }

    var presentation = this.presentation;
    var prePathSubNode = this.prePathSubNode;
    var prePathNode = this.prePathNode;

    prePathSubNode.href = prePathNode.href =
      this.protocolNode.value = (missingProtocol ? "" : this.uri.scheme + "://");
    this.subDomainNode.value = "";
    this.portNode.value = "";

    var host = this.uri.host;
    if (host) {
      try {
        let baseDomainAscii = this._tldService.getBaseDomainFromHost(host);
        let baseDomain = this._idnService.convertToDisplayIDN(baseDomainAscii, {});
        let hostInSameForm = (this._idnService.isACE(baseDomain)) ? this._idnService.convertUTF8toACE(host) : host;
        if (hostInSameForm.lastIndexOf(baseDomain) !== -1) {
          this.subDomainNode.value = hostInSameForm.substring(0, hostInSameForm.lastIndexOf(baseDomain));
          host = baseDomain;
        }
        prePathNode.href += baseDomainAscii;
      } catch (e) {
        prePathNode.href += this.uri.asciiHost;
      }
      prePathSubNode.href += this.uri.asciiHost;
      this.domainNode.value = host;
      if (this.uri.port > -1) {
        prePathSubNode.href += (this.portNode.value = ":" + this.uri.port);
        prePathNode.href += (this.portNode.value = ":" + this.uri.port);
      }
      this.presentation.classList.remove("no-host");
    } else {
      this.domainNode.value = "";
      this.presentation.classList.add("no-host");
    }
    prePathSubNode.href += "/";
    prePathNode.href += "/";
    var href = prePathSubNode.href;
    var baseHref = href;

    while (prePathNode.nextSibling != this.pathFileNode)
      presentation.removeChild(prePathNode.nextSibling);

    var pathSegments = losslessDecodeURI(this.uri).replace(/^[^:]*:\/\/[^\/]*\//, "");

    var iFragment = pathSegments.indexOf("#");
    if (iFragment > -1) {
      this.fragmentNode.value = pathSegments.substring(iFragment);
      pathSegments = pathSegments.substring(0, iFragment);
    } else
      this.fragmentNode.value = "";

    var iQuery = pathSegments.indexOf("?");
    if (iQuery > -1) {
      this.queryNode.value = pathSegments.substring(iQuery);
      pathSegments = pathSegments.substring(0, iQuery);
    } else
      this.queryNode.value = "";

    pathSegments = pathSegments.split("/");
    this.fileNode.value = pathSegments.pop();

    for (var i = 0; i < pathSegments.length; i++) {
      var node = this.pathSegmentProto.cloneNode(true);
      node.value = pathSegments[i];
      node.href = (href += pathSegments[i] + "/");
      presentation.insertBefore(node, this.pathFileNode);
    }
    this.pathFileNode.href = (href += this.fileNode.value);
    this.pathFileNodeQ.href = (href += this.queryNode.value);
    this.pathFileNodeF.href = (href += this.fragmentNode.value);

    if (href == baseHref && href.slice(-1) == "/" && this._mayTrimURLs)
      this.prePathNode.classList.add("hide-trailing-slash");
    else
      this.prePathNode.classList.remove("hide-trailing-slash");

    if (!/^[a-z]*:/.test(this.textValue) && this._mayTrimURLs)
      this.prePathSubNode.classList.add("hide-protocol");
    else
      this.prePathSubNode.classList.remove("hide-protocol");

  }

  _prettyView() {
    this._plain = false;
    this.protocolNode.hidden = false;
    this.presentationBox.hidden = false;
    this.subDomainNode.style.removeProperty("-moz-margin-start");
    this.portNode.style.removeProperty("-moz-margin-end");
  }

  prettyView() {
    if (this.uri) {
      this._prettyView();
      this.plain = false;
    } else {
      this.plain = true;
    }
  }

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "keydown":
        if (this.plain && this._mouseover && !this._focused) {
          switch (aEvent.keyCode) {
            case KeyEvent.DOM_VK_SHIFT:
            case KeyEvent.DOM_VK_CONTROL:
            case KeyEvent.DOM_VK_META:
            case KeyEvent.DOM_VK_ALT:
              this.prettyView();
              this.setAttribute("linkify", "true");
          }
        }
        break;
    }
    this.__proto__.__proto__.handleEvent.call(this, aEvent);
  }

  observe(subject, topic, data) {
    if (topic == "nsPref:changed") {
      switch (data) {
        case "copy_unescaped":
        case "linkify_on_keys":
        case "linkify_on_mouse_icon":
        case "linkify_on_mouse_top":
        case "linkify_on_mouse_bottom":
          this[data] = this._prefsext.getBoolPref(data);
          break;
      }
    }
    this.__proto__.__proto__.observe.call(this, subject, topic, data);
  }

  _getSelectedValueForClipboard() {
    var urlstr = this.__proto__.__proto__._getSelectedValueForClipboard.call(this);
    if (this.copy_unescaped && !this.valueIsTyped && this.selectionStart == 0 && this.selectionEnd == this.inputField.value.length) {
      try {
        return losslessDecodeURI(makeURI(urlstr)).replace(/[()"\s]/g, escape); // escape() doesn't encode @*_+-./
      } catch (e) {
        return urlstr;
      }
    } else {
      return urlstr;
    }
  }

  _enterLinkifyMode() {

    var elthis = this;
    if (!elthis.linkify_on_mouse_icon || elthis._iconWasHovered) return;
    elthis._iconWasHovered = true;
    elthis._iconWasHoveredOutTime = (new Date).getTime();

    var onmove = function(e) {
      var elrect = elthis.getBoundingClientRect();
      if (!elthis.linkify_on_mouse_icon ||
        ((elrect.top - 15) > e.clientY || e.clientY > (elrect.bottom + 15)) ||
        (elrect.top > e.clientY || e.clientY > elrect.bottom) && elthis._iconWasHoveredOutTime + 2500 < (new Date).getTime()) {
        elthis._iconWasHovered = false;
        elthis._iconWasHoveredOutTime = 0;
        window.removeEventListener("mousemove", onmove, false);
      } else {
        elthis._iconWasHoveredOutTime = (new Date).getTime();
      }
    };

    window.addEventListener("mousemove", onmove, false);

  }
}

MozXULElement.implementCustomInterface(AdvUrlbar, [Ci.nsIObserver, Ci.nsIDOMEventListener]);
customElements.define("advancedlocationbar", AdvUrlbar);


class MozSingleSegment extends MozSegment {
  static get markup() {
    return `
    <label class="textbox-presentation-segment-label" anonid="label"></label>
    <label class="textbox-presentation-slash" value="/"></label>
    `;
  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    this.textContent = "";
    this.appendChild(this.constructor.fragment);

  }

  set value(val) {
    this.setAttribute("value", val);
    document.getAnonymousElementByAttribute(this, "anonid", "label").value = val;
    return val;
  }

  get value() {
    return this.getAttribute('value');
  }
}

customElements.define("single-segment", MozSingleSegment, {
  extends: "label",
});


class MozFileSegment extends MozSegment {
  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    const childNodes = [...this.childNodes];
    this.append(...childNodes);

  }
}

customElements.define("file-segment", MozFileSegment, {
  extends: "hbox",
});


class MozSegment extends MozXULElement {
  static get markup() {
    return `
    <label class="textbox-presentation-slash" value="/"></label>
    `;
  }

  constructor() {
    super();

    this.addEventListener("click", (event) => {
      if (event.button != 2 &&
        event.originalTarget != this &&
        event.originalTarget.className != "textbox-presentation-slash" &&
        gURLBar.getAttribute("linkify") == "true") {
        if ("TreeStyleTabService" in window)
          TreeStyleTabService.readyToOpenChildTab(gBrowser.selectedTab);
        openUILinkIn(this.href, whereToOpenLink(event, false, true), { relatedToCurrent: true });
        if ("TreeStyleTabService" in window) // We should reset, if was opened not tab
          TreeStyleTabService.stopToOpenChildTab(gBrowser.selectedTab);
        event.stopPropagation();
        event.preventDefault();
      }
    });

    this.addEventListener("mousedown", (event) => {
      if (event.button != 2 &&
        event.originalTarget != this &&
        event.originalTarget.className != "textbox-presentation-slash")
        event.stopPropagation();
    });

    this.addEventListener("mouseout", (event) => {
      for (var node = event.relatedTarget; node; node = node.parentNode)
        if (node == this)
          return;
      gURLBar._hideURLTooltip();
    });

    this.addEventListener("mousemove", (event) => {
      if (event.originalTarget != this &&
        event.originalTarget.className != "textbox-presentation-slash")
        gURLBar._initURLTooltip(this.href);
      else
        gURLBar._hideURLTooltip();
    });

  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    const childNodes = [...this.childNodes];
    this.append(...childNodes);
    this.appendChild(this.constructor.fragment);

    this.href = "";

  }
}

customElements.define("segment", MozSegment, {
  extends: "hbox",
});

}
