/*
* pandoc-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ld } from "lodash/mod.ts";
import { existsSync } from "fs/mod.ts";

import { kHighlightStyle } from "../../config/constants.ts";
import {
  FormatExtras,
  FormatPandoc,
  kDependencies,
  kQuartoCssVariables,
  kTextHighlightingMode,
  SassBundle,
} from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { kDefaultHighlightStyle } from "./types.ts";

import { sessionTempFile } from "../../core/temp.ts";
import { cssImports, cssResources } from "../../core/css.ts";
import { textHighlightThemePath } from "../../core/resources.ts";

import { kQuartoHtmlDependency } from "../../format/html/format-html.ts";

import { compileSass } from "./sass.ts";

// The output target for a sass bundle
// (controls the overall style tag that is emitted)
interface SassTarget {
  name: string;
  bundles: SassBundle[];
  attribs: Record<string, string>;
}

export async function resolveSassBundles(
  extras: FormatExtras,
  pandoc: FormatPandoc,
  formatBundles?: SassBundle[],
  projectBundles?: SassBundle[],
  project?: ProjectContext,
) {
  extras = ld.cloneDeep(extras);

  const mergedBundles: Record<string, SassBundle[]> = {};

  // groups the bundles by dependency name
  const group = (
    bundles: SassBundle[],
    groupedBundles: Record<string, SassBundle[]>,
  ) => {
    bundles.forEach((bundle) => {
      if (!groupedBundles[bundle.dependency]) {
        groupedBundles[bundle.dependency] = [];
      }
      groupedBundles[bundle.dependency].push(bundle);
    });
  };

  // group project provided bundles
  if (projectBundles) {
    group(projectBundles, mergedBundles);
  }

  // group format provided bundles
  if (formatBundles) {
    group(formatBundles, mergedBundles);
  }

  // Go through and compile the cssPath for each dependency
  let hasDarkStyles = false;
  let defaultStyle: "dark" | "light" | undefined = undefined;
  for (const dependency of Object.keys(mergedBundles)) {
    // compile the cssPath
    const bundles = mergedBundles[dependency];

    // See if any bundles are providing dark specific css
    const hasDark = bundles.some((bundle) => bundle.dark !== undefined);
    defaultStyle = bundles.some((bundle) =>
        bundle.dark !== undefined && bundle.dark.default
      )
      ? "dark"
      : "light";

    const targets: SassTarget[] = [{
      name: `${dependency}.min.css`,
      bundles,
      attribs: {},
    }];
    if (hasDark) {
      // Note that the other bundle provides light
      targets[0].attribs = {
        ...targets[0].attribs,
        ...attribForThemeStyle("light", defaultStyle),
      };

      // Provide a dark bundle for this
      const darkBundles = bundles.map((bundle) => {
        bundle = ld.cloneDeep(bundle);
        bundle.user = bundle.dark?.user || bundle.user;
        bundle.quarto = bundle.dark?.quarto || bundle.quarto;
        bundle.framework = bundle.dark?.framework || bundle.framework;

        // Mark this bundle with a dark key so it is differentiated from the light theme
        bundle.key = bundle.key + "-dark";
        return bundle;
      });
      targets.push({
        name: `${dependency}-dark.min.css`,
        bundles: darkBundles,
        attribs: attribForThemeStyle("dark", defaultStyle),
      });

      hasDarkStyles = true;
    }

    for (const target of targets) {
      let cssPath = await compileSass(target.bundles);

      // look for a sentinel 'dark' value, extract variables
      cssPath = processCssIntoExtras(cssPath, extras);

      // Find any imported stylesheets or url references
      // (These could come from user scss that is merged into our theme, for example)
      const css = Deno.readTextFileSync(cssPath);
      const toDependencies = (paths: string[]) => {
        return paths.map((path) => {
          return {
            name: path,
            path: project ? join(project.dir, path) : path,
            attribs: target.attribs,
          };
        });
      };
      const resources = toDependencies(cssResources(css));
      const imports = toDependencies(cssImports(css));

      // Push the compiled Css onto the dependency
      const extraDeps = extras.html?.[kDependencies];

      if (extraDeps) {
        const existingDependency = extraDeps.find((extraDep) =>
          extraDep.name === dependency
        );

        if (existingDependency) {
          if (!existingDependency.stylesheets) {
            existingDependency.stylesheets = [];
          }
          existingDependency.stylesheets.push({
            name: target.name,
            path: cssPath,
            attribs: target.attribs,
          });

          // Add any css references
          existingDependency.stylesheets.push(...imports);
          existingDependency.resources?.push(...resources);
        } else {
          extraDeps.push({
            name: dependency,
            stylesheets: [{
              name: target.name,
              path: cssPath,
              attribs: target.attribs,
            }, ...imports],
            resources,
          });
        }
      }
    }
  }

  // Resolve generated quarto css variables
  extras = await resolveQuartoSyntaxHighlighting(
    extras,
    pandoc,
    hasDarkStyles ? "light" : "default",
    defaultStyle,
  );

  if (hasDarkStyles) {
    // Provide dark variables for this
    extras = await resolveQuartoSyntaxHighlighting(
      extras,
      pandoc,
      "dark",
      defaultStyle,
    );
  }

  // We'll take care of text highlighting for HTML
  setTextHighlightStyle("none", extras);

  return extras;
}

// Generates syntax highlighting Css and Css variables
async function resolveQuartoSyntaxHighlighting(
  extras: FormatExtras,
  pandoc: FormatPandoc,
  style: "dark" | "light" | "default",
  defaultStyle?: "dark" | "light",
) {
  extras = ld.cloneDeep(extras);

  // If we're using default highlighting, use theme darkness to select highlight style
  const mediaAttr = attribForThemeStyle(style, defaultStyle);
  if (style === "default") {
    if (extras.html?.[kTextHighlightingMode] === "dark") {
      style = "dark";
    }
  }

  // Generate and inject the text highlighting css
  const cssFileName = `quarto-syntax-highlighting${
    style === "dark" ? "-dark" : ""
  }.css`;

  // Read the highlight style (theme name)
  const theme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  if (theme) {
    const themeRaw = readTheme(theme, style);
    if (themeRaw) {
      const themeJson = JSON.parse(themeRaw);

      // Other variables that need to be injected (if any)
      const extraVariables = extras.html?.[kQuartoCssVariables] || [];

      // The text highlighting CSS variables
      const highlightCss = generateThemeCssVars(themeJson);
      if (highlightCss) {
        const rules = [
          highlightCss,
          "",
          "/* other quarto variables */",
          ...extraVariables,
        ];

        // The text highlighting CSS rules
        const textHighlightCssRules = generateThemeCssClasses(themeJson);
        if (textHighlightCssRules) {
          rules.push(...textHighlightCssRules);
        }

        // Compile the scss
        const highlightCssPath = await compileSass([{
          dependency: cssFileName,
          key: cssFileName,
          quarto: {
            defaults: "",
            functions: "",
            mixins: "",
            rules: rules.join("\n"),
          },
        }], false);

        // Find the quarto-html dependency and inject this stylesheet
        const extraDeps = extras.html?.[kDependencies];
        if (extraDeps) {
          const existingDependency = extraDeps.find((extraDep) =>
            extraDep.name === kQuartoHtmlDependency
          );
          if (existingDependency) {
            existingDependency.stylesheets = existingDependency.stylesheets ||
              [];

            existingDependency.stylesheets.push({
              name: cssFileName,
              path: highlightCssPath,
              attribs: mediaAttr,
            });
          }
        }
      }
    }
  }
  return extras;
}

// Generates CSS variables based upon the syntax highlighting rules in a theme file
function generateThemeCssVars(
  themeJson: Record<string, unknown>,
) {
  const textStyles = themeJson["text-styles"] as Record<
    string,
    Record<string, unknown>
  >;
  if (textStyles) {
    const lines: string[] = [];
    lines.push("/* quarto syntax highlight colors */");
    lines.push(":root {");
    Object.keys(textStyles).forEach((styleName) => {
      const abbr = kAbbrevs[styleName];
      if (abbr) {
        const textValues = textStyles[styleName];
        Object.keys(textValues).forEach((textAttr) => {
          switch (textAttr) {
            case "text-color":
              lines.push(
                `  --quarto-hl-${abbr}-color: ${textValues[textAttr] ||
                  "inherit"};`,
              );
              break;
          }
        });
      }
    });
    lines.push("}");
    return lines.join("\n");
  }
  return undefined;
}

// Generates CSS rules based upon the syntax highlighting rules in a theme file
function generateThemeCssClasses(
  themeJson: Record<string, unknown>,
) {
  const textStyles = themeJson["text-styles"] as Record<
    string,
    Record<string, unknown>
  >;
  if (textStyles) {
    const lines: string[] = [];

    Object.keys(textStyles).forEach((styleName) => {
      const abbr = kAbbrevs[styleName];
      if (abbr !== undefined) {
        const textValues = textStyles[styleName];
        const cssValues = generateCssKeyValues(textValues);

        if (abbr !== "") {
          lines.push(`\ncode span.${abbr} {`);
          lines.push(...cssValues);
          lines.push("}\n");
        } else {
          ["code span", "div.sourceCode"].forEach((selector) => {
            lines.push(`\n${selector} {`);
            lines.push(...cssValues);
            lines.push("}\n");
          });
        }
      }
    });
    return lines;
  }
  return undefined;
}

// Processes CSS into format extras (scanning for variables and removing them)
function processCssIntoExtras(cssPath: string, extras: FormatExtras) {
  extras.html = extras.html || {};
  const css = Deno.readTextFileSync(cssPath);

  // Extract dark sentinel value
  if (!extras.html[kTextHighlightingMode] && css.match(/\/\*! dark \*\//g)) {
    setTextHighlightStyle("dark", extras);
  }

  // Extract variables
  const matches = css.matchAll(kVariablesRegex);
  if (matches) {
    extras.html[kQuartoCssVariables] = extras.html[kQuartoCssVariables] || [];
    let dirty = false;
    for (const match of matches) {
      const variables = match[1];
      extras.html[kQuartoCssVariables]?.push(variables);
      dirty = true;
    }

    if (dirty) {
      const cleanedCss = css.replaceAll(kVariablesRegex, "");
      const newCssPath = sessionTempFile({ suffix: ".css" });
      Deno.writeTextFileSync(newCssPath, cleanedCss);
      return newCssPath;
    }
  }
  return cssPath;
}
const kVariablesRegex =
  /\/\*\! quarto-variables-start \*\/([\S\s]*)\/\*\! quarto-variables-end \*\//g;

// Generates key values for CSS text highlighing variables
function generateCssKeyValues(textValues: Record<string, unknown>) {
  const lines: string[] = [];
  Object.keys(textValues).forEach((textAttr) => {
    switch (textAttr) {
      case "text-color":
        lines.push(
          `color: ${textValues[textAttr]};`,
        );
        break;
      case "background":
        lines.push(
          `background-color: ${textValues[textAttr]};`,
        );
        break;

      case "bold":
        if (textValues[textAttr]) {
          lines.push("font-weight: bold;");
        }
        break;
      case "italic":
        if (textValues[textAttr]) {
          lines.push("font-style: italic;");
        }
        break;
      case "underline":
        if (textValues[textAttr]) {
          lines.push("text-decoration: underline;");
        }
        break;
    }
  });
  return lines;
}

// From  https://github.com/jgm/skylighting/blob/a1d02a0db6260c73aaf04aae2e6e18b569caacdc/skylighting-core/src/Skylighting/Format/HTML.hs#L117-L147
const kAbbrevs: Record<string, string> = {
  "Keyword": "kw",
  "DataType": "dt",
  "DecVal": "dv",
  "BaseN": "bn",
  "Float": "fl",
  "Char": "ch",
  "String": "st",
  "Comment": "co",
  "Other": "ot",
  "Alert": "al",
  "Function": "fu",
  "RegionMarker": "re",
  "Error": "er",
  "Constant": "cn",
  "SpecialChar": "sc",
  "VerbatimString": "vs",
  "SpecialString": "ss",
  "Import": "im",
  "Documentation": "do",
  "Annotation": "an",
  "CommentVar": "cv",
  "Variable": "va",
  "ControlFlow": "cf",
  "Operator": "op",
  "BuiltIn": "bu",
  "Extension": "ex",
  "Preprocessor": "pp",
  "Attribute": "at",
  "Information": "in",
  "Warning": "wa",
  "Normal": "",
};

// Attributes for the style tag
// Note that we default disable the dark mode and rely on JS to enable it
function attribForThemeStyle(
  style: "dark" | "light" | "default",
  defaultStyle?: "dark" | "light",
): Record<string, string> {
  const colorModeAttrs = (mode: string, disabled: boolean) => {
    const attr: Record<string, string> = {
      class: `quarto-color-scheme${
        mode === "dark" ? " quarto-color-alternate" : ""
      }`,
    };
    if (disabled) {
      attr.rel = "prefetch";
    }
    return attr;
  };

  switch (style) {
    case "dark":
      return colorModeAttrs("dark", defaultStyle !== "dark");
    case "light":
      return colorModeAttrs("light", false);
    case "default":
    default:
      return {};
  }
}

// Note the text highlight style in extras
export function setTextHighlightStyle(
  style: "light" | "dark" | "none",
  extras: FormatExtras,
) {
  extras.html = extras.html || {};
  extras.html[kTextHighlightingMode] = style;
}

// Reads the contents of a theme file, falling back if the style specific version isn't available
export function readTheme(theme: string, style: "light" | "dark" | "default") {
  const themeFile = textHighlightThemePath(
    theme,
    style === "default" ? undefined : style,
  );
  if (themeFile && existsSync(themeFile)) {
    return Deno.readTextFileSync(themeFile);
  } else {
    return undefined;
  }
}
