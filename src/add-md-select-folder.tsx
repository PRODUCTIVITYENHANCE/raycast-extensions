import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  Icon,
  showToast,
  Toast,
  showHUD,
  Clipboard,
  popToRoot,
  open,
} from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";



interface FolderItem {
  name: string;
  path: string;
  displayName: string;
  isDefault: boolean;
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
 * Recursively get all subfolders
 */
function getSubfolders(rootDir: string, currentPath: string = "", depth: number = 0): FolderItem[] {
  const preferences = getPreferenceValues<Preferences>();
  const defaultSubfolder = preferences.defaultSubfolder;
  const folders: FolderItem[] = [];

  // Limit recursion depth
  if (depth > 3) return folders;

  const fullPath = currentPath ? path.join(rootDir, currentPath) : rootDir;

  try {
    const items = fs.readdirSync(fullPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden folders
      if (item.name.startsWith(".")) continue;

      if (item.isDirectory()) {
        const relativePath = currentPath ? path.join(currentPath, item.name) : item.name;
        const isDefault = relativePath === defaultSubfolder;
        const indent = "  ".repeat(depth);

        folders.push({
          name: item.name,
          path: relativePath,
          displayName: isDefault ? `⭐ ${relativePath} (Default)` : `${indent}📁 ${relativePath}`,
          isDefault,
        });

        // Recursively get subfolders
        folders.push(...getSubfolders(rootDir, relativePath, depth + 1));
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }

  return folders;
}

export default function Command() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [customFilename, setCustomFilename] = useState<string>("");

  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.rootDirectory);
  const defaultSubfolder = preferences.defaultSubfolder;
  const defaultEditor = preferences.defaultEditor;

  // Load clipboard content and folder list
  useEffect(() => {
    async function init() {
      try {
        // Read clipboard
        const text = (await Clipboard.readText()) || "";
        setContent(text);

        // Read folder list
        const subfolders = getSubfolders(rootDir);

        // Sort default folder to the top
        const sortedFolders = subfolders.sort((a, b) => {
          if (a.isDefault) return -1;
          if (b.isDefault) return 1;
          return 0;
        });

        setFolders(sortedFolders);

        // Set initial selected folder
        if (defaultSubfolder) {
          setSelectedFolder(defaultSubfolder);
        } else {
          setSelectedFolder("__root__");
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Initialization failed",
          message: String(error),
        });
      }
      setIsLoading(false);
    }
    init();
  }, [rootDir]);

  /**
   * Core save function, returns saved file path
   */
  const saveFile = async (values: {
    folder: string;
    content: string;
    customFilename: string;
  }): Promise<string | null> => {
    const textContent = values.content.trim();

    if (!textContent) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Content cannot be empty!",
      });
      return null;
    }

    // Determine target directory
    let targetDir: string;
    if (values.folder === "__root__") {
      targetDir = rootDir;
    } else {
      targetDir = path.join(rootDir, values.folder);
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Determine filename: prefer custom filename, otherwise use first line
    let filename: string;
    const customName = values.customFilename.trim();

    if (customName) {
      // Use custom filename
      filename = sanitizeFilename(customName);
    } else {
      // Use first line as filename
      const lines = textContent.split("\n");
      const firstLine = lines[0].trim();
      filename = sanitizeFilename(firstLine);
    }

    // If filename is empty, use timestamp
    if (!filename) {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
      filename = `note-${timestamp}`;
    }

    // Get unique file path
    const filePath = getUniqueFilePath(targetDir, filename);

    try {
      // Write to file
      fs.writeFileSync(filePath, textContent, "utf-8");
      return filePath;
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Save failed!",
        message: String(error),
      });
      return null;
    }
  };

  const handleSubmit = async (values: { folder: string; content: string; customFilename: string }) => {
    const filePath = await saveFile(values);
    if (filePath) {
      const savedFilename = path.basename(filePath);
      const folderName = values.folder === "__root__" ? "Root Directory" : values.folder;
      await showHUD(`✅ Saved: ${savedFilename} → ${folderName}`);
      await popToRoot();
    }
  };

  const handleSubmitAndOpen = async (values: { folder: string; content: string; customFilename: string }) => {
    const filePath = await saveFile(values);
    if (filePath) {
      const savedFilename = path.basename(filePath);
      const editorName = defaultEditor || "Default App";

      try {
        // Open file with specified editor
        if (defaultEditor) {
          await open(filePath, defaultEditor);
        } else {
          await open(filePath);
        }
        await showHUD(`✅ Saved and Opened: ${savedFilename} → ${editorName}`);
      } catch {
        await showHUD(`✅ Saved: ${savedFilename} (Cannot open with ${editorName})`);
      }
      await popToRoot();
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Markdown" icon={Icon.Document} onSubmit={handleSubmit} />
          <Action.SubmitForm
            title={`Save and Open with ${defaultEditor || "Default App"}`}
            icon={Icon.AppWindowSidebarRight}
            shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
            onSubmit={handleSubmitAndOpen}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="folder" title="Select Folder" value={selectedFolder} onChange={setSelectedFolder}>
        <Form.Dropdown.Item
          value="__root__"
          title={defaultSubfolder ? "📁 Root Directory" : "📁 Root Directory (Default)"}
          icon={Icon.Folder}
        />
        {folders.map((folder) => (
          <Form.Dropdown.Item
            key={folder.path}
            value={folder.path}
            title={folder.displayName}
            icon={folder.isDefault ? Icon.Star : Icon.Folder}
          />
        ))}
      </Form.Dropdown>

      <Form.TextField
        id="customFilename"
        title="Custom Filename"
        placeholder="Leave empty to use first line"
        value={customFilename}
        onChange={setCustomFilename}
      />

      <Form.TextArea
        id="content"
        title="Content"
        placeholder="Enter Markdown content..."
        value={content}
        onChange={setContent}
        enableMarkdown
      />

      <Form.Description
        title="Description"
        text="You can enter a custom filename (without .md). If empty, the first line will be used. If the first line is also empty, a timestamp will be used."
      />
    </Form>
  );
}
