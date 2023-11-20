/*
 * format-dashboard-tables.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { lines } from "../../core/text.ts";
import { kDTTableSentinel } from "./format-dashboard-shared.ts";

// Strip regexes
const kStripRegexes = [
  /\/\/ Import jquery and DataTable/,
  /^\s*import 'https:\/\/code\.jquery\.com\/jquery\-.*';$/,
  /^\s*import dt from 'https:\/\/cdn\.datatables\.net\/.*\.mjs';$/,
  /^\s*dt\(\$\);/,
];

// This signals the start of DT initialization
const kDataConfigRegex = /^\s*dt_args\["data"\] = data;$/;

// This is the table initialization
const kDatatableInit =
  /\$\(document\).ready\(function \(\) \{(?:\s|.)*?\$\('#(.*?)'\)\.DataTable\(dt_args\);(?:\s|.)*?\}\);.*/g;

// The href for the datatable CSS that is injected
const kDtCssHrefRegex =
  /^\s*https:\/\/cdn\.datatables\.net\/.*?\/jquery\.dataTables\.min\.css$/;

export function processDatatables(
  doc: Document,
): { resources: string[]; supporting: string[] } {
  const resources: string[] = [];
  const supporting: string[] = [];

  // Look through the scripts in the body and see if we spot Datatables that we should fix up
  const scriptNodes = doc.querySelectorAll(
    ".cell-output script[type='module']",
  );
  for (const scriptNode of scriptNodes) {
    const scriptEl = scriptNode as Element;
    const code = scriptEl.innerText;

    let hasConnectedDt = false;

    // First filter out lines and add configuration
    const codeFiltered: string[] = [];
    for (const line of lines(code)) {
      if (
        kStripRegexes.some((regex) => {
          return !!line.match(regex);
        })
      ) {
        hasConnectedDt = true;
        // ignore this line, we want to strip it
      } else if (line.match(kDataConfigRegex)) {
        // This is the configuration line, add additional configuration here
        codeFiltered.push(line);
      } else {
        codeFiltered.push(line);
      }
    }

    if (hasConnectedDt) {
      // Replace the table initialization
      const codeText = codeFiltered.join("\n");
      const codeWithInit = codeText.replace(
        kDatatableInit,
        "let table = new DataTable('#$1', dt_args);",
      );
      scriptEl.innerText = codeWithInit;

      // Remove the inline css
      const linkCssNodes = doc.querySelectorAll(
        'link[rel="stylesheet"][type="text/css"][href]',
      );
      for (const linkCssNode of linkCssNodes) {
        const linkCssEl = linkCssNode as Element;
        const href = linkCssEl.getAttribute("href");
        if (href?.match(kDtCssHrefRegex)) {
          linkCssEl.remove();
        }
      }

      // We found tables, clear the DT sentinel attr
      const dtNodes = doc.querySelectorAll(`[${kDTTableSentinel}="true"]`);
      dtNodes.forEach((node) => {
        (node as Element).removeAttribute(kDTTableSentinel);
      });
    } else {
      // We didn't find any DT, remove the dependencies that we injected at the root level
      const dtNodes = doc.querySelectorAll(`[${kDTTableSentinel}="true"]`);
      dtNodes.forEach((node) => {
        (node as Element).remove();
      });
    }
  }

  return {
    resources,
    supporting,
  };
}
