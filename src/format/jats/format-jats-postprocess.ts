/*
 * format-jats-postprocess.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";
import { JatsRenderSubArticle, xmlPlaceholder } from "./format-jats-types.ts";

import { dirname, join, relative } from "path/mod.ts";
import { copySync } from "fs/copy.ts";
import { readLines } from "io/mod.ts";
import { ProjectContext } from "../../project/types.ts";
import { logProgress } from "../../core/log.ts";
import { kJatsSubarticle } from "../../render/notebook/notebook-types.ts";
import { locateAnnotation } from "../../core/lib/yaml-intelligence/annotated-yaml.ts";

// XML Linting
export const reformatXmlPostProcessor = async (output: string) => {
  await reformat(output);
};

// Injects the root subarticle
export const renderSubarticlePostProcessor = (
  input: string,
  subArticles: JatsRenderSubArticle[],
  services: RenderServices,
  project?: ProjectContext,
) => {
  return async (output: string) => {
    const subArticlesToRender = subArticles.filter((subArticle) => {
      return services.notebook.get(subArticle.input) === undefined;
    });

    const total = subArticlesToRender.length;
    if (subArticlesToRender.length > 0) {
      logProgress("Rendering JATS sub-articles");
    }

    let count = 0;
    for (const subArticle of subArticlesToRender) {
      const subArticlePath = subArticle.input;
      const nbRelPath = relative(dirname(input), subArticlePath);
      logProgress(`[${++count}/${total}] ${nbRelPath}`);

      await services.notebook.render(
        subArticlePath,
        kJatsSubarticle,
        services,
        project,
      );
    }

    const supportingOut: string[] = [];
    for (const subArticle of subArticles) {
      console.log({ subArticle });
      const nb = services.notebook.get(subArticle.input);
      if (nb && nb[kJatsSubarticle]) {
        let outputContents = Deno.readTextFileSync(output);

        const notebook = nb[kJatsSubarticle];
        const jatsSubarticlePath = notebook.path;
        const placeholder = xmlPlaceholder(
          subArticle.token,
          subArticle.input,
        );

        const subArtReader = await Deno.open(jatsSubarticlePath);
        const subArtLines: string[] = [];
        for await (let line of readLines(subArtReader)) {
          // Process ids (add a suffix to all ids and rids)
          line = line.replaceAll(kIdRegex, `$1id="$2-${subArticle.token}"`);
          line = line.replaceAll(kRidRegex, `$1rid="$2-${subArticle.token}"`);
          subArtLines.push(line);
        }
        // Replace the placeholder with the rendered subarticle
        outputContents = outputContents.replaceAll(
          placeholder,
          subArtLines.join("\n"),
        );

        // Move supporting and resource files into place
        for (const support of notebook.supporting) {
          // get the supporting relative path
          const basePath = project ? project.dir : dirname(notebook.path);
          const fromPath = join(basePath, support);
          const toPath = join(
            dirname(output),
            relative(dirname(notebook.path), fromPath),
          );
          console.log({ from: fromPath, to: toPath });
          copySync(fromPath, toPath, { overwrite: true });

          supportingOut.push(toPath);
        }

        Deno.writeTextFileSync(output, outputContents);

        // TODO: Push resources here
      }
    }
    return {
      supporting: supportingOut,
    };
  };
};

const kIdRegex = /(\s+)id="([^"]*)"/g;
const kRidRegex = /(\s+)rid="([^"]*)"/g;
