/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { basename, dirname, join } from "path/mod.ts";

import { projectContext } from "../project/project-context.ts";
import { TempContext } from "../core/temp-types.ts";
import { unzip } from "../core/zip.ts";
import { copyTo } from "../core/copy.ts";
import { Extension, kExtensionDir } from "./extension-shared.ts";
import { withSpinner } from "../core/console.ts";
import { downloadWithProgress } from "../core/download.ts";
import { readExtensions } from "./extension.ts";
import { info } from "log/mod.ts";

export interface ExtensionSource {
  type: "remote" | "local";
  owner?: string;
  resolvedTarget: string;
  targetSubdir?: string;
}
const kUnversionedFrom = "  (?)";
const kUnversionedTo = "(?)  ";

// Core Installation
export async function installExtension(
  target: string,
  temp: TempContext,
  allowPrompt: boolean,
) {
  // Is this local or remote?
  const source = extensionSource(target);

  // Does the user trust the extension?
  const trusted = await isTrusted(source, allowPrompt);
  if (!trusted) {
    // Not trusted, cancel
    cancelInstallation();
  } else {
    // Compute the installation directory
    const currentDir = Deno.cwd();
    const installDir = await determineInstallDir(currentDir, allowPrompt);

    // Stage the extension locally
    const extensionDir = await stageExtension(source, temp.createDir());

    // Validate the extension in in the staging dir
    const stagedExtensions = validateExtension(extensionDir);

    // Confirm that the user would like to take this action
    const confirmed = await confirmInstallation(
      stagedExtensions,
      installDir,
      allowPrompt,
    );

    if (confirmed) {
      // Complete the installation
      await completeInstallation(extensionDir, installDir);
    } else {
      // Not confirmed, cancel the installation
      cancelInstallation();
    }
  }
}

// Cancels the installation, providing user feedback that the installation is canceled
function cancelInstallation() {
  info("Installation canceled\n");
}

// Determines whether the user trusts the extension
async function isTrusted(
  source: ExtensionSource,
  allowPrompt: boolean,
): Promise<boolean> {
  if (allowPrompt && source.type === "remote") {
    // Write the preamble
    const preamble =
      `\nQuarto extensions may execute code when documents are rendered. If you do not \ntrust the authors of the extension, we recommend that you do not install or \nuse the extension.\n\n`;
    info(preamble);

    // Ask for trust
    const question = "Do you trust the authors of this extension";
    const confirmed: boolean = await Confirm.prompt(question);

    return confirmed;
  } else {
    return true;
  }
}

// If the installation is happening in a project
// we should offer to install the extension into the project
async function determineInstallDir(dir: string, allowPrompt: boolean) {
  const project = await projectContext(dir);
  if (project && project.dir !== dir) {
    const question = "Install extension into project?";
    if (allowPrompt) {
      const useProject = await Confirm.prompt(question);
      if (useProject) {
        return project.dir;
      } else {
        return dir;
      }
    } else {
      return dir;
    }
  } else {
    return dir;
  }
}

// This downloads or copies the extension files into a temporary working
// directory that we can use to enumerate, compare, etc... when deciding
// whether to proceed with installation
//
// Currently supports
// - Remote Paths
// - Local files (tarballs / zips)
// - Local folders (either the path to the _extensions directory or its parent)
async function stageExtension(
  source: ExtensionSource,
  workingDir: string,
) {
  if (source.type === "remote") {
    // Stages a remote file by downloading and unzipping it
    const archiveDir = join(workingDir, "achive");
    ensureDirSync(archiveDir);

    // The filename
    const filename = source.resolvedTarget.split("/").pop() || "extension.zip";

    // The tarball path
    const toFile = join(archiveDir, filename);

    // Download the file
    await downloadWithProgress(source.resolvedTarget, `Downloading`, toFile);

    return unzipAndStage(toFile, source);
  } else {
    if (Deno.statSync(source.resolvedTarget).isDirectory) {
      // Copy the extension dir only
      const srcDir = extensionDir(source.resolvedTarget);
      if (srcDir) {
        const destDir = join(workingDir, kExtensionDir);
        // If there is something to stage, go for it, otherwise
        // just leave the directory empty
        readAndCopyExtensions(srcDir, destDir);
      }
      return workingDir;
    } else {
      const filename = basename(source.resolvedTarget);

      // A local copy of a zip file
      const toFile = join(workingDir, filename);
      copyTo(source.resolvedTarget, toFile);
      return unzipAndStage(toFile, source);
    }
  }
}

// Unpack and stage a zipped file
async function unzipAndStage(
  zipFile: string,
  source: ExtensionSource,
) {
  // Unzip the file
  await withSpinner(
    { message: "Unzipping" },
    async () => {
      // Unzip the archive
      const result = await unzip(zipFile);
      if (!result.success) {
        throw new Error("Failed to unzip extension.\n" + result.stderr);
      }

      // Remove the tar ball itself
      await Deno.remove(zipFile);

      return Promise.resolve();
    },
  );

  // Use any subdirectory inside, if appropriate
  const archiveDir = dirname(zipFile);

  // Use a subdirectory if the source provides one
  const extensionsDir = source.targetSubdir
    ? join(archiveDir, source.targetSubdir)
    : extensionDir(archiveDir) || archiveDir;

  // Make the final directory we're staging into
  const finalDir = join(archiveDir, "staged");
  const finalExtensionsDir = join(finalDir, "_extensions");
  const finalExtensionTargetDir = source.owner
    ? join(finalExtensionsDir, source.owner)
    : finalExtensionsDir;
  ensureDirSync(finalExtensionTargetDir);

  // Move extensions into the target directory (root or owner)
  readAndCopyExtensions(extensionsDir, finalExtensionTargetDir);

  return finalDir;
}

// Reads the extensions from an extensions directory and copies
// them to a destination directory
function readAndCopyExtensions(extensionsDir: string, targetDir: string) {
  const extensions = readExtensions(extensionsDir);
  info(`    Found ${extensions.length} extensions.`);

  for (const extension of extensions) {
    copyTo(
      extension.path,
      join(targetDir, extension.id.name),
    );
  }
}

// Validates that a path on disk is a valid path to extensions
// Currently just ensures there is an _extensions directory
// and that the directory contains readable extensions
function validateExtension(path: string) {
  const extensionsFolder = extensionDir(path);
  if (!extensionsFolder) {
    throw new Error(
      `Invalid extension\nThe extension staged at ${path} is missing an '_extensions' folder.`,
    );
  }

  const extensions = readExtensions(extensionsFolder);
  if (extensions.length === 0) {
    throw new Error(
      `Invalid extension\nThe extension staged at ${path} does not provide any valid extensions.`,
    );
  }
  return extensions;
}

// Confirm that the user would like to proceed with the installation
async function confirmInstallation(
  extensions: Extension[],
  installDir: string,
  allowPrompt: boolean,
) {
  const readExisting = () => {
    try {
      const existingExtensionsDir = join(installDir, kExtensionDir);
      if (Deno.statSync(existingExtensionsDir).isDirectory) {
        const existingExtensions = readExtensions(
          join(installDir, kExtensionDir),
        );
        return existingExtensions;
      } else {
        return [];
      }
    } catch {
      return [];
    }
  };

  const name = (extension: Extension) => {
    const idStr = extension.id.organization
      ? `${extension.id.organization}/${extension.id.name}`
      : extension.id.name;
    return extension.title || idStr;
  };

  const existingExtensions = readExisting();
  const existing = (extension: Extension) => {
    return existingExtensions.find((existing) => {
      return existing.id.name === extension.id.name &&
        existing.id.organization === extension.id.organization;
    });
  };

  const typeStr = (to: Extension) => {
    const contributes = to.contributes;
    const extTypes: string[] = [];
    if (
      contributes.format &&
      Object.keys(contributes.format).length > 0
    ) {
      Object.keys(contributes.format).length === 1
        ? extTypes.push("format")
        : extTypes.push("formats");
    }

    if (
      contributes.shortcodes &&
      contributes.shortcodes.length > 0
    ) {
      contributes.shortcodes.length === 1
        ? extTypes.push("shortcode")
        : extTypes.push("shortcodes");
    }

    if (contributes.filters && contributes.filters.length > 0) {
      contributes.filters.length === 1
        ? extTypes.push("filter")
        : extTypes.push("filters");
    }

    if (extTypes.length > 0) {
      return `(${extTypes.join(",")})`;
    } else {
      return "";
    }
  };

  const versionMessage = (to: Extension, from?: Extension) => {
    if (to && !from) {
      const versionStr = to.version?.format();
      // New Install
      return {
        action: "Install",
        from: "",
        to: versionStr,
      };
    } else {
      if (to.version && from?.version) {
        // From version to version
        const comparison = to.version.compare(from.version);
        if (comparison === 0) {
          return {
            action: "No Change",
            from: "",
            to: "",
          };
        } else if (comparison > 0) {
          return {
            action: "Update",
            from: from.version.format(),
            to: to.version.format(),
          };
        } else {
          return {
            action: "Revert",
            from: from.version.format(),
            to: to.version.format(),
          };
        }
      } else if (to.version && !from?.version) {
        // From unversioned to versioned
        return {
          action: "Update",
          from: kUnversionedFrom,
          to: to.version.format(),
        };
      } else if (!to.version && from?.version) {
        // From versioned to unversioned
        return {
          action: "Update",
          from: from.version.format(),
          to: kUnversionedTo,
        };
      } else {
        // Both unversioned
        return {
          action: "Update",
          from: kUnversionedFrom,
          to: kUnversionedTo,
        };
      }
    }
  };

  const extensionRows: string[][] = [];
  for (const stagedExtension of extensions) {
    const installedExtension = existing(stagedExtension);
    const message = versionMessage(
      stagedExtension,
      installedExtension,
    );

    const types = typeStr(stagedExtension);
    if (message) {
      extensionRows.push([
        name(stagedExtension) + "  ",
        `[${message.action}]`,
        message.from || "",
        message.to && message.from ? "->" : "",
        message.to || "",
        types,
      ]);
    }
  }

  if (extensionRows.length > 0) {
    const table = new Table(...extensionRows);
    info(`\nThe following changes will be made:\n${table.toString()}\n\n`);
    const question = "Would you like to continue";
    return !allowPrompt || await Confirm.prompt(question);
  } else {
    info(`\nNo changes required - extensions already installed.\n\n`);
    return true;
  }
}

// Copy the extension files into place
async function completeInstallation(downloadDir: string, installDir: string) {
  info("\n");
  await withSpinner({
    message: `Copying`,
    doneMessage: `Extension installation complete`,
  }, () => {
    copyTo(downloadDir, installDir, { overwrite: true });
    return Promise.resolve();
  });
}

// Is this _extensions or does this contain _extensions?
const extensionDir = (path: string) => {
  if (basename(path) === kExtensionDir) {
    // If this is pointing to an _extensions dir, use that
    return path;
  } else {
    // Otherwise, add _extensions to this and use that
    const extDir = join(path, kExtensionDir);
    if (existsSync(extDir) && Deno.statSync(extDir).isDirectory) {
      return extDir;
    } else {
      return undefined;
    }
  }
};

const githubTagRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/tags\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;
const githubLatestRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/heads\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;

function extensionSource(target: string): ExtensionSource {
  if (existsSync(target)) {
    return { type: "local", resolvedTarget: target };
  } else {
    let resolved;
    for (const resolver of resolvers) {
      resolved = resolver(target);
      if (resolved) {
        break;
      }
    }

    return {
      type: "remote",
      resolvedTarget: resolved?.url || target,
      owner: resolved?.owner,
      targetSubdir: resolved ? repoSubdirectory(resolved.url) : undefined,
    };
  }
}

function repoSubdirectory(url: string) {
  const tagMatch = url.match(githubTagRegexp);
  if (tagMatch) {
    return tagMatch[2] + "-" + tagMatch[3];
  } else {
    const latestMatch = url.match(githubLatestRegexp);
    if (latestMatch) {
      return latestMatch[2] + "-" + latestMatch[3];
    } else {
      return undefined;
    }
  }
}

const githubNameRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)(?:@latest)?$/;
const githubLatest = (name: string) => {
  const match = name.match(githubNameRegex);
  if (match) {
    return {
      url: `https://github.com/${match[1]}/${
        match[2]
      }/archive/refs/heads/main.tar.gz`,
      owner: match[1],
    };
  } else {
    return undefined;
  }
};

const githubVersionRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)@v([a-zA-Z0-9-_\.]*)$/;
const githubVersion = (name: string) => {
  const match = name.match(githubVersionRegex);
  if (match) {
    return {
      url: `https://github.com/${match[1]}/${match[2]}/archive/refs/tags/v${
        match[3]
      }.tar.gz`,
      owner: match[1],
    };
  } else {
    return undefined;
  }
};

interface ResolvedExtensionInfo {
  url: string;
  owner?: string;
}
const resolvers: ExtensionNameResolver[] = [githubLatest, githubVersion];

type ExtensionNameResolver = (
  name: string,
) => ResolvedExtensionInfo | undefined;
