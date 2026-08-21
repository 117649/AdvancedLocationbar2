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
      <hbox anonid="presentation-box" class="textbox-presentation-box" flex="1" align="center">
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

      this._prefsext = Services.prefs.getBranch("extensions.advancedlocationbar.");
      this._prefObserver = (...args) => this.observe(...args);
      this._urlPresentation = new AdvancedLocationbar.UrlPresentation({
        idnService: Components.classes["@mozilla.org/network/idn-service;1"]
          .getService(Components.interfaces.nsIIDNService),
        ioService: Components.classes["@mozilla.org/network/io-service;1"]
          .getService(Components.interfaces.nsIIOService),
        parseURL: value => URL.parse(value),
        tldService: Components.classes["@mozilla.org/network/effective-tld-service;1"]
          .getService(Components.interfaces.nsIEffectiveTLDService),
      });
      this._decodeURL = value => this._urlPresentation.decode(value);
      this._host = new AdvancedLocationbar.FirefoxLocationbar(window);

      this.linkify_on_keys = this._prefsext.getBoolPref("linkify_on_keys");

      this.linkify_on_mouse_icon = this._prefsext.getBoolPref("linkify_on_mouse_icon");

      this.linkify_on_mouse_top = this._prefsext.getBoolPref("linkify_on_mouse_top");

      this.linkify_on_mouse_bottom = this._prefsext.getBoolPref("linkify_on_mouse_bottom");

      var node = document.createXULElement("hbox", { is: 'single-segment' });
      node.className = "textbox-presentation-segment textbox-presentation-path";

      this.pathSegmentProto = node;

      var node2 = document.createXULElement("hbox", { is: 'searchparam-segment' });

      this.paramSegmentProto = node2;
    }

    set scroll_on_mouse_wheel(bool) {
      return this._host.setWheel(bool);
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this._prefsext.addObserver("", this._prefObserver, false);
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this.uri = "";

      this._focused = "";

      this._justFocusedFromPretty = "";

      this._mouseover = "";

      this._iconWasHovered = "";

      this._iconWasHoveredOutTime = "";

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

      try {
        this.overflowEllipsis.value =
          Services.prefs.getComplexValue("intl.ellipsis",
            Components.interfaces.nsIPrefLocalizedString).data;
      } catch (ex) {
        this.overflowEllipsis.value = "\u2026";
      }

      this._host.connect(this);
      this.copy_unescaped = this._prefsext.getBoolPref("copy_unescaped");
      this.scroll_on_mouse_wheel = this._prefsext.getBoolPref("scroll_on_mouse_wheel");
      this.plain = true;
    }

    disconnectedCallback() {
      this._prefsext.removeObserver("", this._prefObserver);
      this._host.disconnect();
    }

    set plain(val) {
      return this._host.setPlain(val);
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
      return this._host.value;
    }

    get _mayTrimURLs() {
      return this._host.trimURLs;
    }

    set copy_unescaped(val) {
      if (val != this._copy_unescaped) {
        this._host.setClipboard(val, this._decodeURL);
      }
      return this._copy_unescaped = val;
    }

    get copy_unescaped() {
      return this._copy_unescaped;
    }

    _syncValue() {
      const plan = this._urlPresentation.plan(
        this.value,
        this._mayTrimURLs,
        this._host.untrimmedValue
      );
      this._presentationPlan = plan;
      this.uri = plan ? plan.uri : null;
      if (!plan) {
        this._contentIsCropped = false;
        return;
      }

      while (this.prePathNode.nextSibling != this.pathFileNode) {
        this.presentation.removeChild(this.prePathNode.nextSibling);
      }
      while (this.pathFileNodeQ.nextSibling != this.pathFileNodeF) {
        this.presentation.removeChild(this.pathFileNodeQ.nextSibling);
      }

      this.prePathSubNode.href = plan.prePathSubHref;
      this.prePathNode.href = plan.prePathHref;
      this.protocolNode.value = plan.protocol;
      this.subDomainNode.value = plan.subdomain;
      this.domainNode.value = plan.domain;
      this.portNode.value = plan.port;
      this.presentation.classList.toggle("no-host", !plan.hasHost);

      for (const segment of plan.pathSegments) {
        const node = this.pathSegmentProto.cloneNode(true);
        node.value = segment.value;
        node.href = segment.href;
        this.presentation.insertBefore(node, this.pathFileNode);
      }
      this.fileNode.value = plan.file.value;
      this.pathFileNode.href = plan.file.href;
      this.queryNode.value = plan.query;
      this.pathFileNodeQ.href = plan.queryHref;
      for (const segment of plan.querySegments) {
        const node = this.paramSegmentProto.cloneNode(true);
        node.value = segment.value;
        node.href = segment.href;
        this.presentation.insertBefore(node, this.pathFileNodeF);
      }
      this.fragmentNode.value = plan.fragment;
      this.pathFileNodeF.href = plan.href;
      this.prePathNode.classList.toggle("hide-trailing-slash", plan.hideTrailingSlash);
      this.prePathSubNode.classList.toggle("hide-protocol", plan.hideProtocol);
    }

    _changeQuery(node, plus) {
      const nodes = [...this.getElementsByClassName("textbox-presentation-searchParam")];
      const changedIndex = nodes.indexOf(node);
      const previousScrollMax = this.presentation.scrollLeftMax;
      const plan = this._urlPresentation.changeQuery(
        this._presentationPlan,
        changedIndex,
        plus
      );
      this._presentationPlan = plan;
      nodes[changedIndex].value = plan.querySegments[changedIndex].value;
      for (let index = changedIndex; index < nodes.length; index++) {
        nodes[index].href = plan.querySegments[index].href;
      }
      this.pathFileNodeQ.href = plan.queryHref;
      this.pathFileNodeF.href = plan.href;
      this.presentation.scrollLeft += this.presentation.scrollLeftMax - previousScrollMax;
      this._host.writeValue(plan.href);
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
      this._host.forwardObserver(subject, topic, data);
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

  }

  // MozXULElement.implementCustomInterface(AdvUrlbar, [Ci.nsIObserver/* , Ci.nsIDOMEventListener */]);
  customElements.define("advancedlocationbar", AdvUrlbar);

  class MozSegment extends MozXULElement {
    static get markup() {
      return `
    <label class="textbox-presentation-slash" value="/"></label>
    `;
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.appendChild(this.constructor.fragment);

      this.href = "";
      this.closest("advancedlocationbar")._host.connectSegment(this);
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
      this.closest("advancedlocationbar")._host.connectSegment(this);
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
          <toolbarbutton class="textbox-presentation-segment-numbutton">
          </toolbarbutton>
          <toolbarbutton class="textbox-presentation-segment-numbutton">
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

      let b = this.getElementsByClassName("textbox-presentation-segment-numbutton");
      b[0].addEventListener("click", event => { this._onButton(true); event.stopPropagation(); });
      b[1].addEventListener("click", event => { this._onButton(false); event.stopPropagation(); });
      this.closest("advancedlocationbar")._host.connectSegment(this);
    }

    _onButton(plus) {
      this.closest("advancedlocationbar")._changeQuery(this, plus);
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
      this.closest("advancedlocationbar")._host.connectSegment(this);
    }
  }

  customElements.define("file-segment", MozFileSegment, {
    extends: "hbox",
  });

  AdvancedLocationbar.FirefoxLocationbar.mount(window);
}
