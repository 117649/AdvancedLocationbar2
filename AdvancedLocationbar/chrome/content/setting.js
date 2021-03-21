/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

  "use strict";

  // This is loaded into all XUL windows. Wrap in a block to prevent
  // leaking to window scope.
  {
  
  class MozSettingBase extends MozXULElement {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
  
      this._observer = {
        _self: this,
  
        QueryInterface(aIID) {
          const Ci = Components.interfaces;
          if (aIID.equals(Ci.nsIObserver) ||
            aIID.equals(Ci.nsISupportsWeakReference) ||
            aIID.equals(Ci.nsISupports))
            return this;
  
          throw Components.Exception("No interface", Components.results.NS_ERROR_NO_INTERFACE);
        },
  
        observe(aSubject, aTopic, aPrefName) {
          if (aTopic != "nsPref:changed")
            return;
  
          if (this._self.pref == aPrefName)
            this._self.preferenceChanged();
        }
      };
  
      this._updatingInput = false;
  
      this.input = document.getAnonymousElementByAttribute(this, "anonid", "input");
  
      this.settings = this.parentNode.localName == "settings" ? this.parentNode : null;
  
      this.preferenceChanged();
  
      this.addEventListener("keypress", function(event) {
        event.stopPropagation();
      });
  
      if (this.usePref)
        Services.prefs.addObserver(this.pref, this._observer, true);
  
    }
  
    get usePref() {
      return this.hasAttribute('pref');
    }
  
    get pref() {
      return this.getAttribute('pref');
    }
  
    get type() {
      return this.getAttribute('type');
    }
  
    set value(val) {
      return this.input.value = val;
    }
  
    get value() {
      return this.input.value;
    }
  
    fireEvent(eventName, funcStr) {
      let body = funcStr || this.getAttribute(eventName);
      if (!body)
        return;
  
      try {
        let event = document.createEvent("Events");
        event.initEvent(eventName, true, true);
        let f = new Function("event", body);
        f.call(this, event);
      } catch (e) {
        Cu.reportError(e);
      }
    }
  
    valueFromPreference() {
      // Should be code to set the from the preference input.value
      throw Components.Exception("No valueFromPreference implementation",
        Components.results.NS_ERROR_NOT_IMPLEMENTED);
    }
  
    valueToPreference() {
      // Should be code to set the input.value from the preference
      throw Components.Exception("No valueToPreference implementation",
        Components.results.NS_ERROR_NOT_IMPLEMENTED);
    }
  
    inputChanged() {
      if (this.usePref && !this._updatingInput) {
        this.valueToPreference();
        this.fireEvent("oninputchanged");
      }
    }
  
    preferenceChanged() {
      if (this.usePref) {
        this._updatingInput = true;
        try {
          this.valueFromPreference();
          this.fireEvent("onpreferencechanged");
        } catch (e) {}
        this._updatingInput = false;
      }
    }
  }
  
  customElements.define("setting-base", MozSettingBase);
  
  class MozSettingBool extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
          <label class="preferences-learnmore text-link" onclick="document.getBindingParent(this).openLearnMore()"></label>
        </vbox>
        <hbox class="preferences-alignment">
          <checkbox anonid="input" inherits="disabled,onlabel,offlabel,label=checkboxlabel" oncommand="inputChanged();"></checkbox>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
        "[anonid]='input'": "disabled,onlabel,offlabel,label=checkboxlabel",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
    }
  
    set value(val) {
      return this.input.setChecked(val);
    }
  
    get value() {
      return this.input.checked;
    }
  
    get inverted() {
      return this.getAttribute('inverted');
    }
  
    valueFromPreference() {
      let val = Services.prefs.getBoolPref(this.pref);
      this.value = this.inverted ? !val : val;
    }
  
    valueToPreference() {
      let val = this.value;
      Services.prefs.setBoolPref(this.pref, this.inverted ? !val : val);
    }
  
    openLearnMore() {
      window.open(this.getAttribute("learnmore"), "_blank");
    }
  }
  
  customElements.define("setting-bool", MozSettingBool);
  
  class MozSettingBoolint extends MozSettingBool {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
  
    }
  
    valueFromPreference() {
      let val = Services.prefs.getIntPref(this.pref);
      this.value = (val == this.getAttribute("on"));
    }
  
    valueToPreference() {
      Services.prefs.setIntPref(this.pref, this.getAttribute(this.value ? "on" : "off"));
    }
  }
  
  customElements.define("setting-boolint", MozSettingBoolint);
  
  class MozSettingLocalizedBool extends MozSettingBool {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
  
    }
  
    valueFromPreference() {
      let val = Services.prefs.getComplexValue(this.pref, Components.interfaces.nsIPrefLocalizedString).data;
      if (this.inverted) val = !val;
      this.value = (val == "true");
    }
  
    valueToPreference() {
      let val = this.value;
      if (this.inverted) val = !val;
      let pref = Components.classes["@mozilla.org/pref-localizedstring;1"].createInstance(Components.interfaces.nsIPrefLocalizedString);
      pref.data = this.inverted ? (!val).toString() : val.toString();
      Services.prefs.setComplexValue(this.pref, Components.interfaces.nsIPrefLocalizedString, pref);
    }
  }
  
  customElements.define("setting-localized-bool", MozSettingLocalizedBool);
  
  class MozSettingInteger extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
          <textbox type="number" anonid="input" oninput="inputChanged();" onchange="inputChanged();" inherits="disabled,emptytext,min,max,increment,hidespinbuttons,wraparound,size"></textbox>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
        "[anonid]='input'": "disabled,emptytext,min,max,increment,hidespinbuttons,wraparound,size",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
    }
  
    valueFromPreference() {
      let val = Services.prefs.getIntPref(this.pref);
      this.value = val;
    }
  
    valueToPreference() {
      Services.prefs.setIntPref(this.pref, this.value);
    }
  }
  
  customElements.define("setting-integer", MozSettingInteger);
  
  class MozSettingControl extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
        </hbox>
     `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      let fragment = this.constructor.fragment.cloneNode(true);
      const children = fragment.querySelector('.preferences-alignment');
      const childNodes = [...this.childNodes];
      this.appendChild(fragment);
      children.append(...childNodes);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
    }
  }
  
  customElements.define("setting-control", MozSettingControl);
  
  class MozSettingString extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
          <textbox anonid="input" flex="1" oninput="inputChanged();" inherits="disabled,emptytext,type=inputtype,min,max,increment,hidespinbuttons,decimalplaces,wraparound"></textbox>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
        "[anonid]='input'": "disabled,emptytext,type=inputtype,min,max,increment,hidespinbuttons,decimalplaces,wraparound",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
    }
  
    valueFromPreference() {
      this.value = Preferences.get(this.pref, "");
    }
  
    valueToPreference() {
      Preferences.set(this.pref, this.value);
    }
  }
  
  customElements.define("setting-string", MozSettingString);
  
  class MozSettingColor extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
          <colorpicker type="button" anonid="input" inherits="disabled" onchange="document.getBindingParent(this).inputChanged();"></colorpicker>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
        "[anonid]='input'": "disabled",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
    }
  
    set value(val) {
      return this.input.color = val;
    }
  
    get value() {
      return this.input.color;
    }
  
    valueFromPreference() {
      // We must wait for the colorpicker's binding to be applied before setting the value
      if (!this.input.color)
        this.input.initialize();
      this.value = Services.prefs.getCharPref(this.pref);
    }
  
    valueToPreference() {
      Services.prefs.setCharPref(this.pref, this.value);
    }
  }
  
  customElements.define("setting-color", MozSettingColor);
  
  class MozSettingPath extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
          <button type="button" anonid="button" label="FROM-DTD.settings.path.button.label;" inherits="disabled" oncommand="showPicker();"></button>
          <label anonid="input" flex="1" crop="center" inherits="disabled"></label>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
        "[anonid]='button'": "disabled",
        "[anonid]='input'": "disabled",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
      this._value = "";
  
    }
  
    set value(val) {
      this._value = val;
      let label = "";
      if (val) {
        try {
          let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          file.initWithPath(val);
          label = this.hasAttribute("fullpath") ? file.path : file.leafName;
        } catch (e) {}
      }
      this.input.tooltipText = val;
      return this.input.value = label;
    }
  
    get value() {
      return this._value;
    }
  
    showPicker() {
      var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      filePicker.init(window, this.getAttribute("title"),
        this.type == "file" ? Ci.nsIFilePicker.modeOpen : Ci.nsIFilePicker.modeGetFolder);
      if (this.value) {
        try {
          let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          file.initWithPath(this.value);
          filePicker.displayDirectory = this.type == "file" ? file.parent : file;
          if (this.type == "file") {
            filePicker.defaultString = file.leafName;
          }
        } catch (e) {}
      }
      filePicker.open(rv => {
        if (rv != Ci.nsIFilePicker.returnCancel && filePicker.file) {
          this.value = filePicker.file.path;
          this.inputChanged();
        }
      });
    }
  
    valueFromPreference() {
      this.value = Preferences.get(this.pref, "");
    }
  
    valueToPreference() {
      Preferences.set(this.pref, this.value);
    }
  }
  
  customElements.define("setting-path", MozSettingPath);
  
  class MozSettingMulti extends MozSettingBase {
    static get markup() {
      return `
        <vbox>
          <hbox class="preferences-alignment">
            <label class="preferences-title" flex="1" inherits="text=title"></label>
          </hbox>
          <description class="preferences-description" flex="1" inherits="text=desc"></description>
        </vbox>
        <hbox class="preferences-alignment">
          <children includes="radiogroup|menulist"></children>
        </hbox>
      `;
    }

    static get inheritedAttributes() {
      return {
        ".preferences-title": "text=title",
        ".preferences-description": "text=desc",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      let fragment = this.constructor.fragment.cloneNode(true);
      const children = fragment.querySelector('.preferences-alignment');
      const childNodes = [...this.childNodes].filter(child => child.tagName == 'radiogroup' || child.tagName == 'menulist');
      this.appendChild(fragment);
      children.append(...childNodes);
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();
  
      this.control = this.getElementsByTagName(this.getAttribute("type") == "radio" ? "radiogroup" : "menulist")[0];
  
      this.control.addEventListener("command", this.inputChanged.bind(this));
  
    }
  
    valueFromPreference() {
      let val = Preferences.get(this.pref, "").toString();
  
      if ("itemCount" in this.control) {
        for (let i = 0; i < this.control.itemCount; i++) {
          if (this.control.getItemAtIndex(i).value == val) {
            this.control.selectedIndex = i;
            break;
          }
        }
      } else {
        this.control.setAttribute("value", val);
      }
    }
  
    valueToPreference() {
      // We might not have a pref already set, so we guess the type from the value attribute
      let val = this.control.selectedItem.value;
      if (val == "true" || val == "false") {
        val = val == "true";
      } else if (/^-?\d+$/.test(val)) {
        val = parseInt(val, 10);
      }
      Preferences.set(this.pref, val);
    }
  }
  
  customElements.define("setting-multi", MozSettingMulti);
  
  }
  