const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

// eslint-disable-next-line no-control-regex
const INVALID_XML_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g;
const CSS_URL_RE = /url\((['"]?)([^'")]+)\1\)/g;
// Values only: Tailwind class names contain them too, escaped (`\[60vw\]`).
const VIEWPORT_UNIT_RE =
  /(?<=(?<!\\)[\s(,:])(-?(?:\d+\.?\d*|\.\d+))(?:d|s|l)?(vw|vh|vmin|vmax)\b/g;

// Each snapshot is a new document: transitions would replay from its initial
// zero-size layout and animations would restart. Running animations are put
// back at their current point per element (see animationDelays).
const SETTLED_DELAY = "-3600s";
const SETTLE_CSS = `*, ::before, ::after { transition: none !important; animation-delay: ${SETTLED_DELAY} !important; }`;

export type Snapshot = {
  image: HTMLImageElement;
  width: number;
  height: number;
};

type ImageCache = Map<string, string | Promise<string>>;
type StyledElement = Element & ElementCSSInlineStyle;
type View = Window & typeof globalThis;

// `instanceof` must use the document's own window: the stage is an iframe.
const viewOf = (doc: Document) => doc.defaultView as View;

const readAsDataUrl = async (url: string) => {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

// An SVG image can't load anything, so every url() is inlined.
const inlineCssUrls = async (css: string, base: string) => {
  const urls = new Set<string>();
  for (const [, , url] of css.matchAll(CSS_URL_RE)) {
    if (!url.startsWith("data:")) urls.add(url);
  }
  const inlined = new Map(
    await Promise.all(
      Array.from(urls, async (url) => {
        const data = await readAsDataUrl(new URL(url, base).href).catch(
          () => url,
        );
        return [url, data] as const;
      }),
    ),
  );
  return css.replace(
    CSS_URL_RE,
    (_, _quote, url: string) => `url("${inlined.get(url) ?? url}")`,
  );
};

// Cross-origin stylesheets (Google Fonts) aren't readable through the CSSOM.
const fetchFontFaces = async (href: string, families: Set<string>) => {
  try {
    const css = await (await fetch(href, { mode: "cors" })).text();
    const faces = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).filter(
      (face) => {
        const family = /font-family:\s*(['"]?)([^'";]+)\1/.exec(face)?.[2];
        return !!family && families.has(family.trim());
      },
    );
    return inlineCssUrls(faces.join("\n"), href);
  } catch (err) {
    console.warn("Recording without web fonts:", err);
    return "";
  }
};

const collectCss = async (doc: Document) => {
  const view = viewOf(doc);
  const families = new Set<string>();
  doc.fonts.forEach((face) => {
    if (face.status === "loaded") {
      families.add(face.family.replace(/^["']|["']$/g, ""));
    }
  });

  const parts: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof view.CSSImportRule)) {
        parts.push(rule.cssText);
        continue;
      }
      let imported: CSSRuleList | undefined;
      try {
        imported = rule.styleSheet?.cssRules;
      } catch {
        imported = undefined;
      }
      if (imported) parts.push(...Array.from(imported, (r) => r.cssText));
      else if (rule.href) parts.push(await fetchFontFaces(rule.href, families));
    }
  }
  return inlineCssUrls(parts.join("\n"), doc.baseURI);
};

const cacheImage = async (cache: ImageCache, src: string) => {
  const data = readAsDataUrl(src).catch(() => "");
  cache.set(src, data);
  cache.set(src, await data);
};

const imageSource = (img: HTMLImageElement) => img.currentSrc || img.src;

// The delay list that puts a freshly started copy of each element's running
// CSS animations where they are on the page.
const animationDelays = (doc: Document) => {
  const view = viewOf(doc);
  const running = new Map<Element, CSSAnimation[]>();
  for (const animation of doc.getAnimations()) {
    const effect = animation.effect;
    if (
      !(animation instanceof view.CSSAnimation) ||
      !(effect instanceof view.KeyframeEffect) ||
      !effect.target ||
      effect.pseudoElement ||
      animation.currentTime === null
    ) {
      continue;
    }
    running.set(effect.target, [
      ...(running.get(effect.target) ?? []),
      animation,
    ]);
  }

  const delays = new Map<Element, string>();
  for (const [element, animations] of running) {
    const names = view.getComputedStyle(element).animationName.split(/,\s*/);
    const values = names.map((name) => {
      const animation = animations.find((a) => a.animationName === name);
      if (!animation) return SETTLED_DELAY;
      const delay = Number(animation.effect?.getTiming().delay ?? 0);
      return `${delay - Number(animation.currentTime)}ms`;
    });
    delays.set(element, values.join(", "));
  }
  return delays;
};

// Snapshots flatten 3D, so `backface-visibility: hidden` stops hiding the
// far side of a flip card; it would show mirrored on top.
const hiddenBackfaces = (doc: Document) => {
  const view = viewOf(doc);
  const hidden = new Set<Element>();
  const candidates = doc.body.querySelectorAll(
    '[style*="backface-visibility"], [class*="backface"]',
  );
  for (const element of Array.from(candidates)) {
    if (view.getComputedStyle(element).backfaceVisibility !== "hidden") {
      continue;
    }
    let matrix = new DOMMatrix();
    for (let node: Element | null = element; node; node = node.parentElement) {
      const transform = view.getComputedStyle(node).transform;
      if (transform !== "none") {
        matrix = new DOMMatrix(transform).multiply(matrix);
      }
    }
    if (matrix.m33 < 0) hidden.add(element);
  }
  return hidden;
};

const inlineImage = (
  original: HTMLImageElement,
  copy: Element,
  cache: ImageCache,
) => {
  const src = imageSource(original);
  const cached = cache.get(src);
  if (typeof cached === "string") {
    copy.setAttribute("src", cached);
  } else {
    if (src && !cached) void cacheImage(cache, src);
    copy.removeAttribute("src");
  }
  copy.removeAttribute("srcset");
  copy.removeAttribute("loading");
};

const canvasToImage = (original: HTMLCanvasElement, copy: Element) => {
  const img = copy.ownerDocument.createElement("img");
  for (const attr of Array.from(copy.attributes)) {
    img.setAttribute(attr.name, attr.value);
  }
  if (original.width && original.height) {
    try {
      img.src = original.toDataURL();
    } catch {
      // A tainted canvas stays blank.
    }
  }
  copy.replaceWith(img);
};

const copyFormState = (original: Element, copy: Element, view: View) => {
  if (original instanceof view.HTMLTextAreaElement) {
    copy.textContent = original.value;
  } else if (original instanceof view.HTMLInputElement) {
    copy.setAttribute("value", original.value);
    copy.toggleAttribute("checked", original.checked);
  } else if (original instanceof view.HTMLOptionElement) {
    copy.toggleAttribute("selected", original.selected);
  }
};

const applyScroll = (original: Element, copy: StyledElement) => {
  copy.style.overflow = "hidden";
  for (const child of Array.from(copy.children) as StyledElement[]) {
    child.style.translate = `${-original.scrollLeft}px ${-original.scrollTop}px`;
  }
};

const cloneBody = (doc: Document, cache: ImageCache) => {
  const view = viewOf(doc);
  const clone = doc.body.cloneNode(true) as HTMLElement;
  // Same order, so the lists line up element for element.
  const originals = doc.body.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");
  const delays = animationDelays(doc);
  const backfaces = hiddenBackfaces(doc);

  originals.forEach((original, i) => {
    const copy = copies[i] as StyledElement;
    if (
      original instanceof view.HTMLScriptElement ||
      original instanceof view.HTMLLinkElement ||
      original.tagName === "NOSCRIPT"
    ) {
      copy.remove();
      return;
    }

    const delay = delays.get(original);
    if (delay) copy.style.setProperty("animation-delay", delay, "important");
    if (backfaces.has(original)) copy.style.visibility = "hidden";
    if (original.scrollTop || original.scrollLeft) applyScroll(original, copy);

    if (original instanceof view.HTMLImageElement) {
      inlineImage(original, copy, cache);
    } else if (original instanceof view.HTMLCanvasElement) {
      canvasToImage(original, copy);
    } else {
      copyFormState(original, copy, view);
    }
  });
  return clone;
};

// Firefox resolves viewport units in an SVG image against the size it's drawn
// at rather than the page's, so they're resolved up front.
const resolveViewportUnits = (css: string, width: number, height: number) => {
  const units: Record<string, number> = {
    vw: width,
    vh: height,
    vmin: Math.min(width, height),
    vmax: Math.max(width, height),
  };
  return css.replace(
    VIEWPORT_UNIT_RE,
    (_, value: string, unit: string) =>
      `${(Number(value) * units[unit]) / 100}px`,
  );
};

const serialize = (
  doc: Document,
  css: string,
  cache: ImageCache,
  width: number,
  height: number,
) => {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // On the SVG root so `:root` theme variables apply.
  const style = doc.createElementNS(SVG_NS, "style");
  style.textContent = css;
  const foreignObject = doc.createElementNS(SVG_NS, "foreignObject");
  svg.append(style, foreignObject);
  for (const element of [svg, foreignObject]) {
    element.setAttribute("width", String(width));
    element.setAttribute("height", String(height));
  }

  const html = doc.createElementNS(XHTML_NS, "html") as HTMLElement;
  for (const attr of Array.from(doc.documentElement.attributes)) {
    html.setAttribute(attr.name, attr.value);
  }
  Object.assign(html.style, {
    width: `${width}px`,
    height: `${height}px`,
    overflow: "hidden",
  });
  html.appendChild(cloneBody(doc, cache));
  foreignObject.appendChild(html);

  return new XMLSerializer().serializeToString(svg).replace(INVALID_XML_RE, "");
};

// A data: URL, not a blob: URL: Chrome treats a blob: SVG containing a
// <foreignObject> as cross-origin, which taints the canvas.
const decodeSvg = async (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const image = new Image();
  image.decoding = "async";
  image.src = `data:image/svg+xml;base64,${btoa(binary)}`;
  await image.decode();
  return image;
};

/** Returns a function that renders `doc` as it is now into an image. */
export const createSnapshotter = async (doc: Document) => {
  const images: ImageCache = new Map();
  const sources = new Set(
    Array.from(doc.body.querySelectorAll("img"), imageSource),
  );
  const [css] = await Promise.all([
    collectCss(doc),
    ...Array.from(sources)
      .filter((src) => src && !src.startsWith("data:"))
      .map((src) => cacheImage(images, src)),
  ]);

  let sized = { key: "", css: "" };
  return async (): Promise<Snapshot> => {
    const { clientWidth: width, clientHeight: height } = doc.documentElement;
    const key = `${width}x${height}`;
    if (sized.key !== key) {
      sized = {
        key,
        css: resolveViewportUnits(css, width, height) + SETTLE_CSS,
      };
    }
    const text = serialize(doc, sized.css, images, width, height);
    return { image: await decodeSvg(text), width, height };
  };
};
