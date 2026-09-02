/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var AdvancedLocationbar = {};

AdvancedLocationbar.UrlPresentation = class UrlPresentation {
  constructor({ idnService, ioService, parseURL, tldService }) {
    this._idnService = idnService;
    this._ioService = ioService;
    this._parseURL = parseURL;
    this._tldService = tldService;
  }

  plan(value, trimURLs, untrimmedValue = value) {
    if (!value) {
      return null;
    }

    const hideProtocol = trimURLs && !/^[a-z]*:/.test(value);
    let uri;
    try {
      if (hideProtocol) {
        value = /^[a-z]*:/.test(untrimmedValue) ? untrimmedValue : "http://" + value;
      }
      uri = this._ioService.newURI(value, null, null);
      if (typeof uri.host == "undefined") {
        return null;
      }
    } catch (error) {
      return null;
    }

    const protocol = hideProtocol ? "" : uri.scheme + "://";
    let domain = "";
    let port = "";
    let prePathHref = uri.scheme + "://";
    let prePathSubHref = uri.scheme + "://";
    let subdomain = "";
    let host = uri.host;
    const hasHost = Boolean(host);
    if (host) {
      try {
        const baseDomainAscii = this._tldService.getBaseDomainFromHost(host);
        const baseDomain = this._idnService.convertToDisplayIDN(baseDomainAscii);
        const hostInSameForm = this._idnService.convertToDisplayIDN(host);
        if (hostInSameForm.lastIndexOf(baseDomain) !== -1) {
          subdomain = hostInSameForm.substring(0, hostInSameForm.lastIndexOf(baseDomain));
          host = baseDomain;
        }
        prePathHref += baseDomainAscii;
      } catch (error) {
        prePathHref += uri.asciiHost;
      }
      prePathSubHref += uri.asciiHost;
      domain = host;
      if (uri.port > -1) {
        port = ":" + uri.port;
        prePathHref += port;
        prePathSubHref += port;
      }
    }
    prePathHref += "/";
    prePathSubHref += "/";

    let path = this._decodeURI(uri).replace(/^[^:]*:\/\/[^\/]*\//, "");
    let fragment = "";
    const fragmentIndex = path.indexOf("#");
    if (fragmentIndex > -1) {
      fragment = path.substring(fragmentIndex);
      path = path.substring(0, fragmentIndex);
    }

    let query = "";
    let queryValues = [];
    const queryIndex = path.indexOf("?");
    if (queryIndex > -1) {
      query = "?";
      queryValues = path.substring(queryIndex + 1).split("&");
      path = path.substring(0, queryIndex);
    }

    const pathValues = path.split("/");
    const fileValue = pathValues.pop();
    let href = prePathSubHref;
    const pathSegments = pathValues.map(value => ({
      href: href += value + "/",
      value,
    }));
    const file = { href: href += fileValue, value: fileValue };
    const { queryHref, querySegments } = this._planQuery(file.href, query, queryValues);
    href = queryHref + fragment;

    return {
      domain,
      file,
      fragment,
      hasHost,
      hideProtocol,
      hideTrailingSlash: trimURLs && href == prePathSubHref && href.endsWith("/"),
      href,
      pathSegments,
      port,
      prePathHref,
      prePathSubHref,
      protocol,
      query,
      queryHref,
      querySegments,
      subdomain,
      uri,
    };
  }

  changeQuery(plan, index, plus) {
    const current = plan.querySegments[index].value;
    const separator = current.indexOf("=");
    const key = separator > -1 ? current.substring(0, separator + 1) : "";
    const number = separator > -1 ? current.substring(separator + 1) : current;
    const changedValue = key + (plus ? Number(number) + 1 : Number(number) - 1);
    const { queryHref, querySegments } = this._planQuery(
      plan.file.href,
      plan.query,
      plan.querySegments.slice(index).map((segment, offset) =>
        offset ? segment.value : changedValue),
      plan.querySegments.slice(0, index)
    );
    return {
      ...plan,
      href: queryHref + plan.fragment,
      queryHref,
      querySegments,
    };
  }

  decode(value) {
    const parsed = this._parseURL(value);
    return parsed ? this._decodeURI(parsed.URI) : "";
  }

  _planQuery(fileHref, query, values, prefix = []) {
    let href = prefix.length ? prefix[prefix.length - 1].href : fileHref;
    const querySegments = prefix.concat(values.map((value, index) => ({
      href: href += (prefix.length + index ? "&" : query) + value,
      value,
    })));
    return { queryHref: query ? href : fileHref, querySegments };
  }

  _decodeURI(uri) {
    let value = uri.displaySpec;
    if (!/%25(?:3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/i.test(value)) {
      if (!["https", "http", "file", "ftp"].includes(uri.scheme)) {
        value = value.replace(/%(2[0-4]|2[6-9a-f]|[3-6][0-9a-f]|7[0-9a-e])/g, decodeURI);
      } else {
        try {
          value = decodeURI(value).replace(
            /%(?!3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/gi,
            encodeURIComponent
          );
        } catch (error) {}
      }
    }
    value = value.replace(
      /[\u0000-\u001f\u007f-\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u2800\u3000\ufffc]|[\r\n\t]|\u0020(?=\u0020)|\s$/g,
      encodeURIComponent
    );
    return value.replace(
      /[\u00ad\u034f\u061c\u06dd\u070f\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\u3164\u0600-\u0605\u08e2\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufffb]|\ud804[\udcbd\udccd]|\ud80d[\udc30-\udc38]|\ud82f[\udca0-\udca3]|\ud834[\udd73-\udd7a]|[\udb40-\udb43][\udc00-\udfff]|\ud83d[\udd0f-\udd13\udee1]/g,
      encodeURIComponent
    );
  }
};

AdvancedLocationbar.FirefoxLocationbar = class FirefoxLocationbar {
  constructor(window) {
    this.window = window;
    this.document = window.document;
    this.urlbar = window.gURLBar;
    this.inputField = this.urlbar.inputField;
    this.inputBox = this.urlbar._inputContainer.getElementsByClassName("urlbar-input-box")[0];
    this._originalClipboard = this.urlbar._getSelectedValueForClipboard;
    this._listeners = [];
    this._prevMouseScrolls = [null, null];
    this._destination = 0;
    this._direction = 0;
  }

  get trimURLs() {
    return this.window.UrlbarPrefs.get("trimURLs");
  }

  get value() {
    return this.inputField.value;
  }

  get untrimmedValue() {
    return this.urlbar.untrimmedValue;
  }

  connect(view) {
    this.view = view;
    for (const [target, type, capture] of [
      [this.inputField, "input"],
      [this.inputField, "ValueChange"],
      [this.inputField, "focus", true],
      [this.inputField, "blur", true],
      [this.urlbar._inputContainer, "mouseover"],
      [this.urlbar._inputContainer, "mouseout"],
      [view.presentationBox, "mousedown"],
      [view.presentationBox, "dragover"],
      [view.presentationBox, "drop"],
    ]) {
      target.addEventListener(type, this, capture);
      this._listeners.push([target, type, capture]);
    }
    if (this._wheelEnabled) {
      this.urlbar._inputContainer.addEventListener("wheel", this);
    }
    if (this._copyUnescaped) {
      this._installClipboard();
    }
  }

  disconnect() {
    this.window.clearTimeout(this._linkifyTimeout);
    for (const [target, type, capture] of this._listeners) {
      target.removeEventListener(type, this, capture);
    }
    this._listeners.length = 0;
    this.urlbar._inputContainer.removeEventListener("wheel", this);
    this.document.removeEventListener("keydown", this.view);
    this.urlbar._getSelectedValueForClipboard = this._originalClipboard;
    this.view = null;
  }

  connectSegment(segment) {
    for (const type of ["click", "mousedown", "mouseout", "mousemove"]) {
      segment.addEventListener(type, this);
    }
  }

  handleEvent(event) {
    if (event.currentTarget == this.inputField) {
      this._onInputEvent(event);
    } else if (event.currentTarget == this.urlbar._inputContainer) {
      if (event.type == "mouseover") this._onMouseover(event);
      else if (event.type == "mouseout") this._onMouseout(event);
      else this._onWheel(event);
    } else if (event.currentTarget == this.view.presentationBox) {
      if (event.type == "mousedown") this.urlbar.focus();
      else if (event.type == "dragover" &&
               Services.droppedLinkHandler.canDropLink(event, true)) event.preventDefault();
      else this.urlbar.handleEvent(event);
    } else {
      this._onSegmentEvent(event);
    }
  }

  setPlain(value) {
    this.view._plain = value;
    if (value) {
      this.inputField.style.removeProperty("opacity");
      this.view.hidden = true;
    } else {
      this.inputField.style.setProperty("opacity", "0", "important");
    }
    this.view.presentationBox.style.removeProperty("opacity");
    this.urlbar._updateUrlTooltip();
    if (value) {
      this.inputField.scrollLeft = this.view.presentation.scrollLeft *
        this.inputField.scrollLeftMax / this.view.presentation.scrollLeftMax;
    } else {
      this.view.presentation.scrollLeft = this.inputField.scrollLeft *
        this.view.presentation.scrollLeftMax / this.inputField.scrollLeftMax;
    }
    return value;
  }

  setWheel(enabled) {
    this._wheelEnabled = enabled;
    if (enabled && this.view) {
      this.urlbar._inputContainer.addEventListener("wheel", this);
    } else {
      this.urlbar._inputContainer.removeEventListener("wheel", this);
    }
    return enabled;
  }

  setClipboard(enabled, decode) {
    this._copyUnescaped = enabled;
    this._decode = decode;
    if (enabled) {
      this._installClipboard();
    } else {
      this.urlbar._getSelectedValueForClipboard = this._originalClipboard;
    }
    return enabled;
  }

  writeValue(value) {
    this._writing = true;
    try {
      this.urlbar.value = value;
    } finally {
      this._writing = false;
    }
  }

  forwardObserver(subject, topic, data) {
    this.urlbar.observe.call(this.view, subject, topic, data);
  }

  _installClipboard() {
    if (!this._originalClipboard) {
      return;
    }
    this.urlbar._getSelectedValueForClipboard = () => {
      const value = this._originalClipboard.call(this.urlbar);
      if (!this.urlbar.valueIsTyped && this.inputField.selectionStart == 0 &&
          this.inputField.selectionEnd == this.inputField.value.length) {
        try {
          return this._decode(value).replace(/[()"\s]/g, escape);
        } catch (error) {}
      }
      return value;
    };
  }

  _onInputEvent(event) {
    if (event.type == "input" || event.type == "ValueChange" && !this._writing) {
      this.view._syncValue();
    } else if (event.type == "focus" && event.originalTarget == this.inputField) {
      if (!this.view._focused) {
        this.view._focused = true;
        this.view._justFocusedFromPretty = true;
        if (!this.view.plain) this.view.plain = true;
      }
      if (this.view._justFocusedFromPretty) {
        this.view._justFocusedFromPretty = false;
        this.window.setTimeout(() => this.inputField.focus());
      }
    } else if (event.type == "blur" && this.view._focused &&
               event.originalTarget == this.inputField) {
      this.view._focused = false;
      this.view._syncValue();
      if (!this.view._mouseover) this.view.prettyView();
    }
  }

  _onMouseover(event) {
    if (this.view.linkify_on_mouse_icon &&
        event.target.closest("#trust-icon-container, #identity-box")) this.view._enterLinkifyMode();
    if (this.view._mouseover) return;
    const bounds = this.inputBox.getBoundingClientRect();
    if (!this.view.plain) {
      if (event.screenX < this.inputBox.screenX ||
          event.screenX > this.inputBox.screenX + bounds.width) return;
    }
    this.view._mouseover = true;
    if (this.view.linkify_on_mouse_icon && this.view._iconWasHovered ||
        this.view.linkify_on_keys && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) ||
        this.view.linkify_on_mouse_top && event.screenY < this.inputBox.screenY + bounds.height / 4 ||
        this.view.linkify_on_mouse_bottom && event.screenY >= this.inputBox.screenY + bounds.height * 3 / 4) {
      this.view.prettyView();
      this.view.setAttribute("linkify", "true");
    } else {
      this._linkifyTimeout = this.window.setTimeout(() => {
        if (this.view._mouseover && this.view.getAttribute("linkify") != "true") {
          this.urlbar.formatValue();
          this.view.plain = true;
          this.document.addEventListener("keydown", this.view);
        }
      }, 50);
    }
  }

  _onMouseout(event) {
    if (event.relatedTarget && this.urlbar._inputContainer.contains(event.relatedTarget)) return;
    this.view.removeAttribute("linkify");
    this.view._mouseover = false;
    if (!this.view._focused && this.view.plain) {
      this.view.prettyView();
      this.document.removeEventListener("keydown", this.view);
    } else {
      this.view.plain = true;
    }
    this.urlbar._updateUrlTooltip();
  }

  _onSegmentEvent(event) {
    const segment = event.currentTarget;
    if (event.type == "click" && event.button != 2 && event.originalTarget != segment &&
        event.originalTarget.className != "textbox-presentation-slash" &&
        this.view.getAttribute("linkify") == "true") {
      const treeStyle = this.window.TreeStyleTabService;
      if (treeStyle) treeStyle.readyToOpenChildTab(this.window.gBrowser.selectedTab);
      this.window.openTrustedLinkIn(
        segment.href,
        this.window.BrowserUtils.whereToOpenLink(event, false, true),
        { relatedToCurrent: true }
      );
      if (treeStyle) treeStyle.stopToOpenChildTab(this.window.gBrowser.selectedTab);
      event.stopPropagation();
      event.preventDefault();
    } else if (event.type == "mousedown" && event.button != 2 &&
               event.originalTarget != segment &&
               event.originalTarget.className != "textbox-presentation-slash") {
      event.stopPropagation();
    } else if (event.type == "mouseout") {
      for (let node = event.relatedTarget; node; node = node.parentNode) {
        if (node == segment) return;
      }
      this.urlbar._updateUrlTooltip();
    } else if (event.type == "mousemove" && event.originalTarget != segment &&
               event.originalTarget.className != "textbox-presentation-slash") {
      this.urlbar._updateUrlTooltip();
    }
  }

  _onWheel(event) {
    let scrolling;
    if (this.view.presentation.scrollLeftMax && !this.view.plain) {
      scrolling = this.view.presentation;
    } else if (this.inputField.scrollLeftMax) {
      scrolling = this.inputField;
    } else {
      return;
    }

    let doScroll = false;
    let instant;
    let scrollAmount = 0;
    const isVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
    const delta = isVertical ? event.deltaY : event.deltaX;
    if (this._isRTLScrollbox === undefined) {
      this._isRTLScrollbox = this.window.getComputedStyle(this.inputField).direction == "rtl";
    }
    const scrollByDelta = isVertical && this._isRTLScrollbox ? -delta : delta;
    if (this._prevMouseScrolls.every(previous => previous == isVertical)) {
      doScroll = true;
      if (event.deltaMode == event.DOM_DELTA_PIXEL) {
        scrollAmount = scrollByDelta;
        instant = true;
      } else if (event.deltaMode == event.DOM_DELTA_PAGE) {
        scrollAmount = scrollByDelta * scrolling.clientWidth;
      } else {
        const length = [...this.view.presentation.querySelectorAll("label[value]")]
          .reduce((total, label) => total + label.value.length, 0);
        scrollAmount = scrollByDelta * (length && scrolling.scrollWidth / length);
      }
    }
    if (this._prevMouseScrolls.length > 1) this._prevMouseScrolls.shift();
    this._prevMouseScrolls.push(isVertical);

    if (doScroll) {
      const direction = scrollAmount < 0 ? -1 : 1;
      const start = scrolling.scrollLeft;
      if (this._direction != direction) {
        this._destination = start + scrollAmount;
        this._direction = direction;
      } else {
        this._destination += scrollAmount;
        scrollAmount = this._destination - start;
      }
      scrolling.scrollBy({ behavior: instant ? "instant" : "auto", left: scrollAmount });
    }
    event.stopPropagation();
    event.preventDefault();
  }

  static mount(window) {
    const input = window.document.getElementById("urlbar-input");
    const previous = window.document.querySelector("advancedlocationbar, .advancedlocationbar");
    if (previous) {
      if (previous.destroy) previous.destroy();
      else previous.plain = true;
      previous.remove();
    }
    const view = window.document.createXULElement("hbox");
    view.classList.add("advancedlocationbar");
    input.parentNode.insertBefore(view, input.nextSibling);
    return view;
  }
};
