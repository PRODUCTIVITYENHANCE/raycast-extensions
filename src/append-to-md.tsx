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
} from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";



interface MarkdownFile {
  name: string;
  path: string;
  folder: string;
  modifiedTime: Date;
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
        });
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }

  return files;
}

export default function Command() {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [content, setContent] = useState("");
  const [addSeparator, setAddSeparator] = useState(true);
  const [addTimestamp, setAddTimestamp] = useState(false);

  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.rootDirectory);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Read clipboard content
        const clipboard = await Clipboard.readText();
        setContent(clipboard || "");

        // Read Markdown files
        const mdFiles = getMarkdownFiles(rootDir);
        // Sort by modification time (newest first)
        mdFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
        setFiles(mdFiles);

        // Default select first file
        if (mdFiles.length > 0) {
          setSelectedFile(mdFiles[0].path);
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to read files",
          message: String(error),
        });
      }
      setIsLoading(false);
    };

    loadData();
  }, [rootDir]);

  const handleSubmit = async () => {
    if (!selectedFile) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please select a file!",
      });
      return;
    }

    if (!content || content.trim() === "") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Content cannot be empty!",
      });
      return;
    }

    const file = files.find((f) => f.path === selectedFile);
    if (!file) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Selected file not found!",
      });
      return;
    }

    try {
      // Read existing content
      const existingContent = fs.readFileSync(file.path, "utf-8");

      // Build content to append
      let appendContent = "";

      // Ensure file ends with newline
      if (existingContent && !existingContent.endsWith("\n")) {
        appendContent += "\n";
      }

      // Add separator
      if (addSeparator) {
        appendContent += "\n---\n\n";
      } else {
        appendContent += "\n";
      }

      // Add timestamp
      if (addTimestamp) {
        const now = new Date();
        const timestamp = now.toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        appendContent += `*${timestamp}*\n\n`;
      }

      // Add content
      appendContent += content;

      // Append to file
      fs.appendFileSync(file.path, appendContent, "utf-8");

      await showHUD(`✅ Appended to: ${file.name}.md`);
      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Append failed!",
        message: String(error),
      });
    }
  };

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Append to Markdown"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Append Content" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="file" title="Select File" value={selectedFile} onChange={setSelectedFile}>
        {files.map((file) => (
          <Form.Dropdown.Item
            key={file.path}
            value={file.path}
            title={`${file.name}.md`}
            icon={Icon.Document}
            keywords={[file.name, file.folder]}
          />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="content"
        title="Content to Append"
        placeholder="Enter text to append..."
        value={content}
        onChange={setContent}
        enableMarkdown
      />

      <Form.Separator />

      <Form.Checkbox id="addSeparator" label="Add Separator (---)" value={addSeparator} onChange={setAddSeparator} />
      <Form.Checkbox id="addTimestamp" label="Add Timestamp" value={addTimestamp} onChange={setAddTimestamp} />
    </Form>
  );
}
