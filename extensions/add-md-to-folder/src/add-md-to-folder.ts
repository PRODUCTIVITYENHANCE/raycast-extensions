import { Clipboard, showHUD, getPreferenceValues, showToast, Toast } from "@raycast/api";
import * as fs from "fs";
import * as path from "path";

/**
 * Sanitize filename: remove illegal characters
 */
function sanitizeFilename(name: string): string {
  // Remove macOS illegal characters (/ : * ? " < > | \)
  let sanitized = name.replace(/[/:*?"<>|\\]/g, " ");
  // Remove extra spaces
  sanitized = sanitized.replace(/\s+/g, " ").trim();
  // Limit length to 80 characters
  return sanitized.slice(0, 80);
}

/**
 * Generate unique file path (handle duplicates)
 */
function getUniqueFilePath(directory: string, filename: string): string {
  const ext = ".md";
  const filePath = path.join(directory, `${filename}${ext}`);

  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  let counter = 1;
  while (fs.existsSync(path.join(directory, `${filename}-${counter}${ext}`))) {
    counter++;
  }

  return path.join(directory, `${filename}-${counter}${ext}`);
}

/**
 * Expand ~ to home directory
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith("~")) {
    return path.join(process.env.HOME || "", filepath.slice(1));
  }
  return filepath;
}

/**
 * Main save logic
 */
export async function saveMarkdownFile(targetFolder?: string): Promise<void> {
  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.rootDirectory);

  // Determine target directory
  let targetDir: string;
  if (targetFolder) {
    targetDir = path.join(rootDir, targetFolder);
  } else if (preferences.defaultSubfolder) {
    targetDir = path.join(rootDir, preferences.defaultSubfolder);
  } else {
    targetDir = rootDir;
  }

  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Read content from clipboard
  const content = await Clipboard.readText();

  if (!content || content.trim() === "") {
    await showToast({
      style: Toast.Style.Failure,
      title: "Clipboard is empty!",
    });
    return;
  }

  // Use first line as filename
  const lines = content.split("\n");
  const firstLine = lines[0].trim();

  // Sanitize filename
  let filename = sanitizeFilename(firstLine);

  // If first line is empty, use timestamp
  if (!filename) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
    filename = `note-${timestamp}`;
  }

  // Get unique file path
  const filePath = getUniqueFilePath(targetDir, filename);

  try {
    // Write to file
    fs.writeFileSync(filePath, content, "utf-8");

    const savedFilename = path.basename(filePath);
    const folderName = targetFolder || preferences.defaultSubfolder || "Root Directory";

    await showHUD(`✅ Saved: ${savedFilename} → ${folderName}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Save failed!",
      message: String(error),
    });
  }
}

/**
 * Quick save command (use default folder)
 */
export default async function Command() {
  await saveMarkdownFile();
}
