import { useEffect } from "react";

const CSS_ASSETS = [
  "/frontend/basic/css/bootstrap-icons.min.css",
  "/frontend/basic/css/bootstrap.min.css",
  "/frontend/basic/css/font-awesome.min.css",
  "/frontend/basic/css/magnific-popup.min.css",
  "/frontend/basic/css/swiper-bundle.min.css",
  "/frontend/basic/css/main.css",
];

const JS_ASSETS = [
  "/frontend/basic/js/jquery-4.0.0.min.js",
  "/frontend/basic/js/bootstrap.bundle.min.js",
  "/frontend/basic/js/swiper-bundle.min.js",
  "/frontend/basic/js/purecounter.js",
  "/frontend/basic/js/imagesloaded-pkgd.js",
  "/frontend/basic/js/isotope.pkgd.min.js",
  "/frontend/basic/js/jquery.magnific-popup.min.js",
  "/frontend/basic/js/animated-headline.js",
  "/frontend/basic/js/plugin.js",
  "/frontend/basic/js/lenis.min.js",
  "/frontend/basic/js/slider-init.js",
  "/frontend/basic/js/main.js",
];

let activeConsumers = 0;

function appendStyles() {
  const added = [];

  CSS_ASSETS.forEach((href) => {
    const existing = document.querySelector(`link[data-landing-asset="1"][href="${href}"]`);
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-landing-asset", "1");
    document.head.appendChild(link);
    added.push(link);
  });

  return added;
}

function appendScripts() {
  const added = [];

  JS_ASSETS.forEach((src) => {
    const existing = document.querySelector(`script[data-landing-asset="1"][src="${src}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute("data-landing-asset", "1");
    document.body.appendChild(script);
    added.push(script);
  });

  return added;
}

export default function useLandingThemeAssets() {
  useEffect(() => {
    activeConsumers += 1;
    document.body.setAttribute("data-landing-theme", "active");
    appendStyles();
    appendScripts();

    return () => {
      activeConsumers = Math.max(0, activeConsumers - 1);
      if (activeConsumers > 0) return;
      removeLandingThemeAssets();
    };
  }, []);
}

export function removeLandingThemeAssets() {
  activeConsumers = 0;
  document.body.removeAttribute("data-landing-theme");

  if (window.__NEXSTOCK_LANDING_LENIS__) {
    window.__NEXSTOCK_LANDING_LENIS__.destroy();
    window.__NEXSTOCK_LANDING_LENIS__ = null;
  }

  if (window.gsap && window.__NEXSTOCK_LANDING_LENIS_TICKER__) {
    window.gsap.ticker.remove(window.__NEXSTOCK_LANDING_LENIS_TICKER__);
    window.__NEXSTOCK_LANDING_LENIS_TICKER__ = null;
  }

  if (window.ScrollSmoother?.get) {
    window.ScrollSmoother.get()?.kill();
  }

  document.documentElement.className = document.documentElement.className
    .replace(/\blenis(?:-\w+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  document.querySelectorAll('link[data-landing-asset="1"]').forEach((node) => {
    if (node.parentNode) node.parentNode.removeChild(node);
  });

  document.querySelectorAll('script[data-landing-asset="1"]').forEach((node) => {
    if (node.parentNode) node.parentNode.removeChild(node);
  });
}
