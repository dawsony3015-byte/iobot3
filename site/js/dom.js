/* Building page elements.
 *
 * h('p', { class: 'muted' }, 'Lunch at ', time) makes <p class="muted">Lunch at …</p>.
 * Text always goes in as text, never as HTML, so nothing in the bulletin can
 * inject markup into the page.
 */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/* One of the line icons defined at the top of index.html. */
export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/* Replace everything inside an element. */
export function fill(el, ...children) {
  el.replaceChildren();
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/* True when the student (or their device) asked for less motion. app.js keeps
   the data-motion attribute up to date from both. */
export function motionReduced() {
  return document.documentElement.dataset.motion === 'reduced';
}

/* Fade an element's new content in. Used when fresh data arrives. Opacity only,
   so it is still fine with reduced motion. */
export function fadeIn(el, duration = 220) {
  el.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration, easing: 'ease-out' });
}
