import { Action, ActionPanel, List, getPreferenceValues, Icon, showToast, Toast, open, Clipboard } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import * as fs from "fs";
import * as path from "path";




interface MarkdownFile {
  name: string;
  path: string;
  folder: string;
  modifiedTime: Date;
  size: number;
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
 * Date grouping type
 */
type DateGroup = "today" | "yesterday" | "past7days" | "past30days" | "older";

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  past7days: "Last 7 Days",
  past30days: "Last 30 Days",
  older: "Older",
};

/**
 * Determine which group a date belongs to
 */
function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const past7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const past30days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (date >= today) return "today";
  if (date >= yesterday) return "yesterday";
  if (date >= past7days) return "past7days";
  if (date >= past30days) return "past30days";
  return "older";
}

/**
 * Group files by date
 */
function groupFilesByDate(files: MarkdownFile[]): Map<DateGroup, MarkdownFile[]> {
  const groups = new Map<DateGroup, MarkdownFile[]>();
  const groupOrder: DateGroup[] = ["today", "yesterday", "past7days", "past30days", "older"];

  // Initialize all groups
  for (const group of groupOrder) {
    groups.set(group, []);
  }

  // Assign files to corresponding groups
  for (const file of files) {
    const group = getDateGroup(file.modifiedTime);
    groups.get(group)!.push(file);
  }

  return groups;
}

/**
 * Recursively get all Markdown files
 */
function getMarkdownFiles(rootDir: string, currentPath: string = "", depth: number = 0): MarkdownFile[] {
  const files: MarkdownFile[] = [];

  // Limit recursion depth
  if (depth > 5) return files;

  const fullPath = currentPath ? path.join(rootDir, currentPath) : rootDir;

  try {
    const items = fs.readdirSync(fullPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files and folders
      if (item.name.startsWith(".")) continue;

      const relativePath = currentPath ? path.join(currentPath, item.name) : item.name;
      const absolutePath = path.join(rootDir, relativePath);

      if (item.isDirectory()) {
        // Recursively enter subfolders
        files.push(...getMarkdownFiles(rootDir, relativePath, depth + 1));
      } else if (item.isFile() && item.name.endsWith(".md")) {
        const stats = fs.statSync(absolutePath);
        files.push({
          name: item.name.replace(/\.md$/, ""),
          path: absolutePath,
          folder: currentPath || "Root Directory",
          modifiedTime: stats.mtime,
          size: stats.size,
        });
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }

  return files;
}

/**
 * Read file content (limit length)
 */
function readFileContent(filePath: string, maxLength: number = 5000): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.length > maxLength) {
      return content.slice(0, maxLength) + "\n\n---\n*(Content truncated...)*";
    }
    return content;
  } catch (error) {
    return `*Cannot read file content: ${error}*`;
  }
}

export default function Command() {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.rootDirectory);

  useEffect(() => {
    try {
      const mdFiles = getMarkdownFiles(rootDir);
      // Sort by modification time (newest first)
      mdFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
      setFiles(mdFiles);
      if (mdFiles.length > 0) {
        setSelectedFile(mdFiles[0]);
      }
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to read files",
        message: String(error),
      });
    }
    setIsLoading(false);
  }, [rootDir]);

  // Get all unique folder list
  const folders = useMemo(() => {
    const folderSet = new Set(files.map((f) => f.folder));
    return Array.from(folderSet).sort();
  }, [files]);

  // Filter files
  const filteredFiles = useMemo(() => {
    if (filterFolder === "all") return files;
    return files.filter((f) => f.folder === filterFolder);
  }, [files, filterFolder]);

  // Group filtered files by date
  const groupedFiles = useMemo(() => {
    return groupFilesByDate(filteredFiles);
  }, [filteredFiles]);

  // Get preview content
  const previewContent = useMemo(() => {
    if (!selectedFile) return "";
    return readFileContent(selectedFile.path);
  }, [selectedFile]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Markdown files..."
      isShowingDetail
      onSelectionChange={(id) => {
        const file = files.find((f) => f.path === id);
        if (file) setSelectedFile(file);
      }}
      searchBarAccessory={
        <List.Dropdown tooltip="Select Folder" storeValue={true} onChange={(newValue) => setFilterFolder(newValue)}>
          <List.Dropdown.Item title="All Folders" value="all" icon={Icon.Globe} />
          <List.Dropdown.Section title="Folders">
            {folders.map((folder) => (
              <List.Dropdown.Item
                key={folder}
                title={folder}
                value={folder}
                icon={folder === "Root Directory" ? Icon.Folder : Icon.Folder}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {(["today", "yesterday", "past7days", "past30days", "older"] as DateGroup[]).map((groupKey) => {
        const groupFiles = groupedFiles.get(groupKey) || [];
        if (groupFiles.length === 0) return null;

        return (
          <List.Section key={groupKey} title={DATE_GROUP_LABELS[groupKey]} subtitle={`${groupFiles.length} files`}>
            {groupFiles.map((file) => (
              <List.Item
                key={file.path}
                id={file.path}
                icon={Icon.Document}
                title={file.name}
                accessories={[{ tag: file.folder }]}
                detail={<List.Item.Detail markdown={previewContent} />}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section title="Actions">
                      <Action
                        title="Copy File Content"
                        icon={Icon.Clipboard}
                        onAction={async () => {
                          const content = fs.readFileSync(file.path, "utf-8");
                          await Clipboard.copy(content);
                          await showToast({ style: Toast.Style.Success, title: "Content copied" });
                        }}
                      />
                      <Action
                        title={`Open Root Directory with ${preferences.defaultEditor || "Default App"}`}
                        icon={Icon.AppWindow}
                        shortcut={{ modifiers: ["cmd"], key: "return" }}
                        onAction={() => {
                          if (preferences.defaultEditor) {
                            open(rootDir, preferences.defaultEditor);
                          } else {
                            open(rootDir);
                          }
                        }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Open With...">
                      <Action
                        title={`Open and Reveal with ${preferences.defaultEditor || "Editor"}`}
                        icon={Icon.Code}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                        onAction={() => {
                          const editor = preferences.defaultEditor || "Visual Studio Code";
                          // Open application with folder and file
                          open(file.path, editor);
                        }}
                      />
                      <Action.Open
                        title="Open with Default App"
                        target={file.path}
                        shortcut={{ modifiers: ["cmd"], key: "o" }}
                      />
                      <Action.ShowInFinder title="Show in Finder" path={file.path} />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Copy">
                      <Action
                        title="Copy File Path"
                        icon={Icon.Link}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        onAction={async () => {
                          await Clipboard.copy(file.path);
                          await showToast({ style: Toast.Style.Success, title: "Path copied" });
                        }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Other">
                      <Action.Trash
                        title="Move to Trash"
                        paths={[file.path]}
                        shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}

      {!isLoading && filteredFiles.length === 0 && (
        <List.EmptyView
          icon={Icon.Document}
          title="No Markdown files found"
          description={filterFolder === "all" ? `Root Directory: ${rootDir}` : `Folder: ${filterFolder}`}
        />
      )}
    </List>
  );
}
