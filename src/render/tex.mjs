// TeX -> SVG with MathJax (in Node, once). Exported for render.mjs.
// Each SVG gets an explicit pixel size from its viewBox (1/1000 em units) and the
// requested font size, and uses currentColor so the page can recolour it.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");

export function texToSvgs(spec) {
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const doc = mathjax.document("", {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: "none" }),
  });
  const out = {};
  for (const [key, { tex, px }] of Object.entries(spec)) {
    const node = doc.convert(tex, { display: true, em: 16, ex: 8, containerWidth: 1600 });
    let svg = adaptor.innerHTML(node);
    if (!svg.startsWith("<svg")) svg = svg.slice(svg.indexOf("<svg"), svg.lastIndexOf("</svg>") + 6);
    if (/data-mjx-error|merror/.test(svg)) throw new Error(`TeX error in ${key}: ${tex}`);
    const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
    const w = (+vb[3] / 1000) * px, h = (+vb[4] / 1000) * px;
    svg = svg.replace(/ width="[^"]*"/, ` width="${w.toFixed(2)}"`).replace(/ height="[^"]*"/, ` height="${h.toFixed(2)}"`)
      .replace(/ style="[^"]*"/, "");
    if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    out[key] = { svg, w, h };
  }
  return out;
}
