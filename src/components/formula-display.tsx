'use client';

import { useEffect, useRef } from 'react';
import './formula-display.css';

// Only a single-letter equality with a simple, parenthesized numerator is styled.
// Unsupported notation stays verbatim; this is a presentation layer, not a solver.
const simpleFraction = /^[ \t]*(\p{L})[ \t]*=[ \t]*\(([ \t]*(?:\p{L}|\d+(?:\.\d+)?)(?:[ \t]*[+\-−×·][ \t]*(?:\p{L}|\d+(?:\.\d+)?))*[ \t]*)\)[ \t]*\/[ \t]*(\p{L})[ \t]*$/u;

export function FormulaDisplay({ content }: { content: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fraction = content.length <= 160 && !/[\r\n]/.test(content)
    ? simpleFraction.exec(content)
    : null;
  const formatted = fraction !== null;

  useEffect(() => {
    if (!formatted) return;
    function copyFormula(event: ClipboardEvent) {
      if (event.defaultPrevented || !event.clipboardData) return;
      const selection = document.getSelection();
      const formula = ref.current;
      if (!formula || !selection || selection.isCollapsed || selection.rangeCount !== 1) return;
      const range = selection.getRangeAt(0);
      // Leave multi-block selections and every other copy operation untouched.
      if (!formula.contains(range.startContainer) || !formula.contains(range.endContainer)) return;
      event.clipboardData.setData('text/plain', content);
      event.preventDefault();
    }
    document.addEventListener('copy', copyFormula);
    return () => document.removeEventListener('copy', copyFormula);
  }, [content, formatted]);

  if (!fraction) return <span ref={ref} className="formula-display formula-display--plain" data-formula-source={content}>{content}</span>;

  return (
    <span ref={ref} className="formula-display formula-display--fraction" data-formula-source={content} role="math" aria-label={content}>
      <span className="formula-display-layout" aria-hidden="true">
        <span className="formula-display-variable">{fraction[1]}</span>
        <span className="formula-display-equals">=</span>
        <span className="formula-display-fraction">
          <span className="formula-display-numerator">{fraction[2].trim()}</span>
          <span className="formula-display-denominator">{fraction[3]}</span>
        </span>
      </span>
    </span>
  );
}
