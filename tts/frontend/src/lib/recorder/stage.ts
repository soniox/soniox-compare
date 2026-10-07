const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 810;

export type Stage = {
  window: Window;
  document: Document;
  /** Resolves once content has been rendered into the stage and settled. */
  ready: () => Promise<void>;
  close: () => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const copyStyles = (from: Document, to: Document) => {
  for (const attr of Array.from(from.documentElement.attributes)) {
    to.documentElement.setAttribute(attr.name, attr.value);
  }
  const loads: Promise<unknown>[] = [];
  from.head
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((node) => {
      const copy = node.cloneNode(true) as HTMLElement;
      if (copy instanceof HTMLLinkElement) {
        loads.push(
          new Promise((resolve) => {
            copy.onload = copy.onerror = resolve;
          }),
        );
      }
      to.head.appendChild(copy);
    });
  return Promise.all(loads);
};

/**
 * A hidden desktop-sized iframe to render the app into for recording, so the
 * video shows the desktop layout whatever the size of the page.
 */
export const openStage = async (): Promise<Stage> => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  // Transparent rather than hidden or off screen, where browsers may stop
  // rendering it.
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${STAGE_WIDTH}px`,
    height: `${STAGE_HEIGHT}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  await copyStyles(document, doc);

  return {
    window: iframe.contentWindow!,
    document: doc,
    async ready() {
      for (let i = 0; i < 100 && !doc.body.firstElementChild; i++) {
        await sleep(20);
      }
      // Measurement-driven layout (card columns) needs a moment to settle.
      await sleep(100);
      await doc.fonts.ready;
    },
    close: () => iframe.remove(),
  };
};
