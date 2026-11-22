import React from "react";
import i18n from "./i18n";

let installed = false;

const TEXT_PROPS = ["placeholder", "title", "alt", "aria-label"];

const isTranslatable = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  return true;
};

const translateString = (value) => {
  if (!isTranslatable(value)) return value;
  const trimmed = value.trim();
  const translated = i18n.t(trimmed);
  return translated || value;
};

const translateChild = (child) => {
  if (typeof child === "string") return translateString(child);
  if (Array.isArray(child)) return child.map(translateChild);
  return child;
};

export const installAutoTranslate = () => {
  if (installed) return;
  installed = true;

  const originalCreateElement = React.createElement;

  React.createElement = (type, props, ...children) => {
    let nextProps = props;

    if (props && typeof props === "object") {
      let cloned = null;
      for (const propName of TEXT_PROPS) {
        if (Object.prototype.hasOwnProperty.call(props, propName) && isTranslatable(props[propName])) {
          if (!cloned) cloned = { ...props };
          cloned[propName] = translateString(props[propName]);
        }
      }
      nextProps = cloned || props;
    }

    const nextChildren = children.map(translateChild);
    return originalCreateElement(type, nextProps, ...nextChildren);
  };
};

