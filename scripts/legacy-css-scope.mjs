import { transform } from 'lightningcss';
import postcss from 'postcss';

const boundary = ':where([data-ui-generation="legacy"],[data-ui-generation="legacy"] *):not(:where([data-ui-generation="next"],[data-ui-generation="next"] *))';
let boundaryComponents;
transform({ filename: 'boundary.css', code: Buffer.from(`${boundary}{color:inherit}`), visitor: { Rule: { style(rule) { boundaryComponents = rule.value.selectors[0]; } } } });

/** Parse selectors, never split on commas or blindly prefix raw CSS.
 * Document-level subjects must be split into neutral reset vs legacy tokens manually.
 * Returning diagnostics instead of pretending those rules are isolated is intentional.
 * This compiler is a migration tool, not yet wired into the production stylesheet build.
 */
export function scopeLegacyCss(css, filename = 'legacy.css') {
  const documentRules = [];
  let scopedSelectors = 0;
  const sheet = postcss.parse(css, { from: filename });
  sheet.walkRules(cssRule => {
    let parent = cssRule.parent;
    while (parent) { if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return; parent = parent.parent; }
    const result = transform({ filename, code: Buffer.from(`${cssRule.selector}{color:inherit}`), minify: false, visitor: { Rule: { style(rule) {
    rule.value.selectors = rule.value.selectors.map(selector => {
      const lastCombinator = selector.findLastIndex(node => node.type === 'combinator');
      const subject = selector.slice(lastCombinator + 1);
      if (subject.some(node => (node.type === 'type' && ['html', 'body'].includes(node.name)) || (node.type === 'pseudo-class' && node.kind === 'root'))) {
        documentRules.push({ line: cssRule.source.start.line, reason: 'document-subject-needs-manual-split' });
        return selector;
      }
      const pseudoElement = selector.findIndex((node, index) => index > lastCombinator && node.type === 'pseudo-element');
      const at = pseudoElement < 0 ? selector.length : pseudoElement;
      scopedSelectors++;
      return [...selector.slice(0, at), ...structuredClone(boundaryComponents), ...selector.slice(at)];
    });
    return rule;
    } } } });
    const output = postcss.parse(result.code.toString());
    if (output.nodes.length !== 1 || output.first.type !== 'rule') {
      throw new Error(`${filename}:${cssRule.source.start.line}: selector serialization expanded unexpectedly`);
    }
    cssRule.selector = output.first.selector;
  });
  return { css: sheet.toString(), documentRules, scopedSelectors };
}
