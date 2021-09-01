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
      <html:link rel="stylesheet" href="chrome://advancedlocationbar/skin/urlbar.css"/>
      <hbox anonid="presentation-box" class="textbox-presentation-box" flex="1" align="center" onmousedown="gURLBar.focus();" ondragover="UrlbarInput.prototype.handleEvent.call(gURLBar, event);" ondrop="UrlbarInput.prototype.handleEvent.call(gURLBar, event);">
        <scrollbox anonid="presentation" class="textbox-presentation" flex="1" align="center">
          <hbox is="base-segment" anonid="prePathSub" class="textbox-presentation-segment textbox-presentation-prePathSub">
            <label anonid="protocol" class="textbox-presentation-protocol"></label>
            <label anonid="subdomain" class="textbox-presentation-subdomain"></label>
          </hbox>
          <hbox is="base-segment" anonid="prePath" class="textbox-presentation-segment textbox-presentation-prePath">
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
      `;
    }

    constructor() {
      super();

      this._prefsext = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService)
        .getBranch("extensions.advancedlocationbar.");

      this._prefsext.addObserver("", (...args) => { this.observe.call(this, ...args) }, false);

      this.linkify_on_keys = this._prefsext.getBoolPref("linkify_on_keys");

      this.linkify_on_mouse_icon = this._prefsext.getBoolPref("linkify_on_mouse_icon");

      this.linkify_on_mouse_top = this._prefsext.getBoolPref("linkify_on_mouse_top");

      this.linkify_on_mouse_bottom = this._prefsext.getBoolPref("linkify_on_mouse_bottom");

      this._tldService = Components.classes["@mozilla.org/network/effective-tld-service;1"]
        .getService(Components.interfaces.nsIEffectiveTLDService);

      this._idnService = Components.classes["@mozilla.org/network/idn-service;1"]
        .getService(Components.interfaces.nsIIDNService);

      this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);

      var node = document.createXULElement("hbox", { is: 'single-segment' });
      node.className = "textbox-presentation-segment textbox-presentation-path";

      this.pathSegmentProto = node;

      var node2 = document.createXULElement("hbox", { is: 'searchparam-segment' });

      this.paramSegmentProto = node2;

      gURLBar.addEventListener("input", (event) => { this._syncValue(); });

      gURLBar.addEventListener("ValueChange", (event) => { if (!this._noSync) { this._syncValue() } })

      gURLBar.textbox.addEventListener("mouseover", (event) => {
        if (this._mouseover)
          return;
        if (!this.plain) {
          var bO = this.inputBox.getBoundingClientRect();
          if (event.screenX < this.inputBox.screenX || event.screenX > this.inputBox.screenX + bO.width)
            return;
        }
        this._mouseover = true;
        var bO = this.getBoundingClientRect();
        if (this.linkify_on_mouse_icon &&
          this._iconWasHovered ||
          this.linkify_on_keys && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) ||
          this.linkify_on_mouse_top && event.screenY < this.inputBox.screenY + bO.height / 4 ||
          this.linkify_on_mouse_bottom && event.screenY >= this.inputBox.screenY + bO.height / 4) {
          this.prettyView();
          this.setAttribute("linkify", "true");
        }
        else
          setTimeout(function (self) {
            if (self._mouseover && self.getAttribute("linkify") != "true") {
              gURLBar.formatValue();
              self.plain = true;
              document.addEventListener("keydown", self, false);
            }
          }, 50, this);
      });

      gURLBar.textbox.addEventListener("mouseout", (event) => {
        for (var node = event.relatedTarget; node; node = node.parentNode)
          if (node == this)
            return;
        this.removeAttribute("linkify");
        this._mouseover = false;
        if (!this._focused && this.plain) {
          this.prettyView();
          document.removeEventListener("keydown", this, false);
        } else this.plain = true;
        gURLBar._updateUrlTooltip();
      });

      gURLBar.addEventListener("focus", (event) => {
        if (!this._focused && event.originalTarget == this.inputField) {
          this._focused = true;
          this._justFocusedFromPretty = true;
          if (!this.plain)
            this.plain = true;
        }
      }, true);

      gURLBar.addEventListener("blur", (event) => {
        if (this._focused && event.originalTarget == this.inputField) {
          this._focused = false;
          this._syncValue();
          if (!this._mouseover)
            this.prettyView();
        }
      }, true);

      this._original_getSelectedValueForClipboard = gURLBar._getSelectedValueForClipboard;

      this.scroll_on_mouse_wheel = this._prefsext.getBoolPref("scroll_on_mouse_wheel");;
    }

    set scroll_on_mouse_wheel(bool) {
      bool ? gURLBar.textbox.addEventListener("wheel", (event) => { this.on_wheel(event) }) :
        gURLBar.textbox.removeEventListener("wheel", (event) => { this.on_wheel(event) });

      return bool;
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this.copy_unescaped = this._prefsext.getBoolPref("copy_unescaped");

      this.uri = "";

      this._focused = "";

      this._justFocusedFromPretty = "";

      this._mouseover = "";

      this._iconWasHovered = "";

      this._iconWasHoveredOutTime = "";

      this.inputBox = gURLBar._inputContainer.getElementsByClassName('urlbar-input-box')[0];

      this.inputBoxInner = gURLBar.inputField;

      this.inputField = gURLBar.inputField;

      this.presentationBox = this.getElementsByAttribute("anonid", "presentation-box")[0];

      this.presentation = this.getElementsByAttribute("anonid", "presentation")[0];

      this.overflowEllipsis = this.getElementsByAttribute("anonid", "overflow-ellipsis")[0];

      this.prePathSubNode = this.getElementsByAttribute("anonid", "prePathSub")[0];

      this.prePathNode = this.getElementsByAttribute("anonid", "prePath")[0];

      this.protocolNode = this.getElementsByAttribute("anonid", "protocol")[0];

      this.subDomainNode = this.getElementsByAttribute("anonid", "subdomain")[0];

      this.domainNode = this.getElementsByAttribute("anonid", "domain")[0];

      this.portNode = this.getElementsByAttribute("anonid", "port")[0];

      this.pathFileNode = this.getElementsByAttribute("anonid", "pathFile")[0];

      this.pathFileNodeQ = this.getElementsByAttribute("anonid", "pathFileQ")[0];

      this.pathFileNodeF = this.getElementsByAttribute("anonid", "pathFileF")[0];

      this.fileNode = this.getElementsByAttribute("anonid", "file")[0];

      this.queryNode = this.getElementsByAttribute("anonid", "query")[0];

      this.fragmentNode = this.getElementsByAttribute("anonid", "fragment")[0];

      this._plain = true;

      this._prevMouseScrolls = [null, null];

      this._destination = 0;

      this._direction = 0;

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

      // Focus hack, I haven't investigated why it's needed
      let self = this;
      this.inputField.addEventListener("focus", function () {
        if (!self._justFocusedFromPretty)
          return;
        self._justFocusedFromPretty = false;
        setTimeout(function () {
          self.inputField.focus();
        });
      }, false);

      this.plain = true;

    }

    set plain(val) {
      this._plain = val;
      if (val) {
        this.inputBoxInner.style.removeProperty("opacity");
        this.hidden = true;
      } else
        this.inputBoxInner.style.setProperty("opacity", "0", "important");
      this.presentationBox.style.removeProperty("opacity");
      gURLBar._updateUrlTooltip();
      val ? this.inputField.scrollLeft = this.presentation.scrollLeft * this.inputField.scrollLeftMax / this.presentation.scrollLeftMax :
        this.presentation.scrollLeft = this.inputField.scrollLeft * this.presentation.scrollLeftMax / this.inputField.scrollLeftMax;
      return val;
    }

    get plain() {
      return this._plain
    }

    set _contentIsCropped(val) {
      this.overflowEllipsis.hidden = !val;
      return val;
    }

    get _contentIsCropped() {
      return !this.overflowEllipsis.hidden;
    }

    get value() {
      return this.inputField.value;
    }

    get _mayTrimURLs() {
      return UrlbarPrefs.get("trimURLs");
    }

    set copy_unescaped(val) {
      if (this._original_getSelectedValueForClipboard && (val != this._copy_unescaped))
        if (val)
          gURLBar._getSelectedValueForClipboard = _ => this._getSelectedValueForClipboard.call(this);
        else
          gURLBar._getSelectedValueForClipboard = this._original_getSelectedValueForClipboard;
      this._copy_unescaped = val;
      return val;
    }

    get copy_unescaped() {
      return this._copy_unescaped;
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
      this.url = new URL(this.uri.spec);

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

      while (this.pathFileNodeQ.nextSibling != this.pathFileNodeF)
        presentation.removeChild(this.pathFileNodeQ.nextSibling);

      var pathSegments = UrlbarInput.prototype._getValueFromResult({ payload: { url: this.uri.spec } }, this.uri.spec).replace(/^[^:]*:\/\/[^\/]*\//, "");

      var iFragment = pathSegments.indexOf("#");
      if (iFragment > -1) {
        this.fragmentNode.value = pathSegments.substring(iFragment);
        pathSegments = pathSegments.substring(0, iFragment);
      } else
        this.fragmentNode.value = "";

      var iQuery = pathSegments.indexOf("?");
      if (iQuery > -1) {
        this.pathFileNodeQ.rferf = pathSegments.substring(iQuery);
        pathSegments = pathSegments.substring(0, iQuery);
        let sp = [...this.pathFileNodeQ.rferf.substring(1).split("&")];
        if (sp.length > 0) {
          this.queryNode.value = "?";
          var h = href + pathSegments + this.queryNode.value;
          for (const p of sp) {
            var node = this.paramSegmentProto.cloneNode(true);
            node.value = p;
            node.href = h += (z || '') + node.value;
            presentation.insertBefore(node, this.pathFileNodeF);
            var z = '&';
          }
        } else this.queryNode.value = this.pathFileNodeQ.rferf;
      } else
        this.pathFileNodeQ.rferf = this.queryNode.value = "";

      pathSegments = pathSegments.split("/");
      this.fileNode.value = pathSegments.pop();

      for (var i = 0; i < pathSegments.length; i++) {
        var node = this.pathSegmentProto.cloneNode(true);
        node.value = pathSegments[i];
        node.href = (href += pathSegments[i] + "/");
        presentation.insertBefore(node, this.pathFileNode);
      }
      this.pathFileNode.href = (href += this.fileNode.value);
      this.pathFileNodeQ.href = (href += this.pathFileNodeQ.rferf);
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

    _updateHref() {
      const sp = [...this.getElementsByClassName("textbox-presentation-searchParam")];
      var href = this.pathFileNode.href + this.queryNode.value;
      for (const node of sp) {
        node.href = (href += (z || '') + node.value);
        var z = '&';
      }
      this.pathFileNodeQ.href = this.pathFileNodeQ.rferf = sp.pop().href;
      this.pathFileNodeF.href = (href += this.fragmentNode.value);
    }

    _prettyView() {
      this._plain = false;
      this.protocolNode.hidden = false;
      this.hidden = false;
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
      // this.__proto__.__proto__.handleEvent.call(this, aEvent);
    }

    observe(subject, topic, data) {
      if (topic == "nsPref:changed") {
        switch (data) {
          case "copy_unescaped":
          case "linkify_on_keys":
          case "linkify_on_mouse_icon":
          case "linkify_on_mouse_top":
          case "linkify_on_mouse_bottom":
          case "scroll_on_mouse_wheel":
            this[data] = this._prefsext.getBoolPref(data);
            break;
        }
      }
      gURLBar.observe.call(this, subject, topic, data);
    }

    _getSelectedValueForClipboard() {
      var urlstr = this._original_getSelectedValueForClipboard.call(gURLBar);
      if (this.copy_unescaped && !gURLBar.valueIsTyped && gURLBar.selectionStart == 0 && gURLBar.selectionEnd == gURLBar.inputField.value.length) {
        try {
          return UrlbarInput.prototype._getValueFromResult({ payload: { url: urlstr } }, urlstr).replace(/[()"\s]/g, escape); // escape() doesn't encode @*_+-./
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

      var onmove = function (e) {
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

    get isRTLScrollbox() {
      if (!this._isRTLScrollbox) {
        this._isRTLScrollbox =
          document.defaultView.getComputedStyle(this.inputField).direction ==
          "rtl";
      }
      return this._isRTLScrollbox;
    }

    on_wheel(event) {
      // Don't consume the event if we can't scroll.
      let scrolling;
      if (this.presentation.scrollLeftMax && !this.plain) {
        scrolling = this.presentation;
      } else if (this.inputField.scrollLeftMax) {
        scrolling = this.inputField;
      } else return;

      let doScroll = false;
      let instant;
      let scrollAmount = 0;

      // We allow vertical scrolling to scroll a horizontal scrollbox
      // because many users have a vertical scroll wheel but no
      // horizontal support.
      // Because of this, we need to avoid scrolling chaos on trackpads
      // and mouse wheels that support simultaneous scrolling in both axes.
      // We do this by scrolling only when the last two scroll events were
      // on the same axis as the current scroll event.
      // For diagonal scroll events we only respect the dominant axis.
      let isVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
      let delta = isVertical ? event.deltaY : event.deltaX;
      let scrollByDelta = isVertical && this.isRTLScrollbox ? -delta : delta;

      if (this._prevMouseScrolls.every(prev => prev == isVertical)) {
        doScroll = true;
        if (event.deltaMode == event.DOM_DELTA_PIXEL) {
          scrollAmount = scrollByDelta;
          instant = true;
        } else if (event.deltaMode == event.DOM_DELTA_PAGE) {
          scrollAmount = scrollByDelta * scrolling.clientWidth;
        } else {
          const elength = Array.prototype.filter.call(this.presentation.children, (el) => { return !!el.href }, this).length
          scrollAmount = scrollByDelta * (elength && scrolling.scrollWidth / elength);
        }
      }

      if (this._prevMouseScrolls.length > 1) {
        this._prevMouseScrolls.shift();
      }
      this._prevMouseScrolls.push(isVertical);


      if (doScroll) {
        let direction = scrollAmount < 0 ? -1 : 1;
        let startPos = scrolling.scrollLeft;

        if (this._direction != direction) {
          this._destination = startPos + scrollAmount;
          this._direction = direction;
        } else {
          // We were already in the process of scrolling in this direction
          this._destination = this._destination + scrollAmount;
          scrollAmount = this._destination - startPos;
        }
        scrolling.scrollBy({ behavior: instant ? "instant" : "auto", left: scrollAmount })

        // this.inputField.scrollLeft = this.presentation.scrollLeft * this.inputField.scrollLeftMax / this.presentation.scrollLeftMax;
      }

      event.stopPropagation();
      event.preventDefault();
    }
  }

  // MozXULElement.implementCustomInterface(AdvUrlbar, [Ci.nsIObserver/* , Ci.nsIDOMEventListener */]);
  customElements.define("advancedlocationbar", AdvUrlbar);

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
          gURLBar.querySelector('advancedlocationbar').getAttribute("linkify") == "true") {
          if ("TreeStyleTabService" in window)
            TreeStyleTabService.readyToOpenChildTab(gBrowser.selectedTab);
          openTrustedLinkIn(this.href, whereToOpenLink(event, false, true), { relatedToCurrent: true });
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
        gURLBar._updateUrlTooltip();
      });

      this.addEventListener("mousemove", (event) => {
        if (event.originalTarget != this &&
          event.originalTarget.className != "textbox-presentation-slash")
          gURLBar._updateUrlTooltip();
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

  customElements.define("base-segment", MozSegment, {
    extends: "hbox",
  });

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
      this._label = this.getElementsByAttribute("anonid", "label")[0];
      this._label.value = this._value;
    }

    set value(val) {
      this._value = val;
      if (this._label) this._label.value = val;
      return val;
    }

    get value() {
      return this._value;
    }
  }

  customElements.define("single-segment", MozSingleSegment, {
    extends: "hbox",
  });

  class MozSearchParamSegment extends MozSegment {
    static get markup() {
      return `
      <label class="textbox-presentation-segment-label textbox-presentation-ampersand" value="&amp;"></label>
      <label class="textbox-presentation-segment-label" anonid="key"></label>
      <div class="textbox-presentation-segment-numbox" align="center">
        <label class="textbox-presentation-segment-label" anonid="value"></label>
        <div align="center">
          <toolbarbutton class="textbox-presentation-segment-numbutton" onclick='_onButton(true);event.stopPropagation();'>
          </toolbarbutton>
          <toolbarbutton class="textbox-presentation-segment-numbutton" onclick='_onButton(false);event.stopPropagation();'>
          </toolbarbutton>
        </div>
      </div>
      `;
    }

    constructor() {
      super();

      this.className = "textbox-presentation-segment textbox-presentation-searchParam";
      this.setAttribute('align', "center");
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      this._labelKey = this.getElementsByAttribute("anonid", "key")[0];
      this._labelValue = this.getElementsByAttribute("anonid", "value")[0];
      this.value = this._value;
    }

    _onButton(plus) {
      var l = this.parentNode.scrollLeftMax;
      this._labelValue.value = plus ? parseInt(this._labelValue.value) + 1 : parseInt(this._labelValue.value) - 1;
      this._value = this._labelKey.value + this._labelValue.value;
      this.parentNode.scrollLeft += (this.parentNode.scrollLeftMax - l);
      this.closest('advancedlocationbar')._updateHref();
      this.closest('advancedlocationbar')._noSync = true;
      gURLBar.value = this.closest('advancedlocationbar').pathFileNodeF.href;
      this.closest('advancedlocationbar')._noSync = false;
    }

    set value(val) {
      this._value = val;
      if (this._labelKey && this._labelValue) {
        let ei = val.indexOf('=')
        if (ei > -1) {
          this._labelKey.value = this._value.substring(0, ei + 1);
          this._labelValue.value = this._value.substring(ei + 1);
        } else this._labelKey.value = this._value;
        if ((+this._labelValue.value === +this._labelValue.value) && this._labelValue.value) this.setAttribute('numeric', true);
        else this.removeAttribute('numeric');
      }
      return val;
    }

    get value() {
      return this._value;
    }
  }

  customElements.define("searchparam-segment", MozSearchParamSegment, {
    extends: "hbox",
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

  const urlbarInput = document.getElementById('urlbar-input');
  var advurl = document.createXULElement('advancedlocationbar')
  urlbarInput.parentNode.insertBefore(
    advurl,
    urlbarInput.nextSibling
  );
  gURLBar._identityBox.addEventListener("mouseover", _ => { advurl._enterLinkifyMode(); });
}