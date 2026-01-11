import {
    Action,
    ActionPanel,
    List,
    getPreferenceValues,
    Icon,
    showToast,
    Toast,
    open,
    Clipboard,
} from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

interface Preferences {
    rootDirectory: string;
    defaultSubfolder: string;
    defaultEditor: string;
}

interface MarkdownFile {
    name: string;
    path: string;
    folder: string;
    modifiedTime: Date;
    size: number;
}

/**
 * 展開 ~ 為 home 目錄
 */
function expandHome(filepath: string): string {
    if (filepath.startsWith("~")) {
        return path.join(process.env.HOME || "", filepath.slice(1));
    }
    return filepath;
}

/**
 * 格式化檔案大小
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化時間
 */
function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) {
            const minutes = Math.floor(diff / (1000 * 60));
            return minutes <= 1 ? "剛剛" : `${minutes} 分鐘前`;
        }
        return `${hours} 小時前`;
    }
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 週前`;

    return date.toLocaleDateString("zh-TW");
}

/**
 * 遞迴取得所有 Markdown 檔案
 */
function getMarkdownFiles(rootDir: string, currentPath: string = "", depth: number = 0): MarkdownFile[] {
    const files: MarkdownFile[] = [];

    // 限制遞迴深度
    if (depth > 5) return files;

    const fullPath = currentPath ? path.join(rootDir, currentPath) : rootDir;

    try {
        const items = fs.readdirSync(fullPath, { withFileTypes: true });

        for (const item of items) {
            // 跳過隱藏檔案和資料夾
            if (item.name.startsWith(".")) continue;

            const relativePath = currentPath ? path.join(currentPath, item.name) : item.name;
            const absolutePath = path.join(rootDir, relativePath);

            if (item.isDirectory()) {
                // 遞迴進入子資料夾
                files.push(...getMarkdownFiles(rootDir, relativePath, depth + 1));
            } else if (item.isFile() && item.name.endsWith(".md")) {
                const stats = fs.statSync(absolutePath);
                files.push({
                    name: item.name.replace(/\.md$/, ""),
                    path: absolutePath,
                    folder: currentPath || "根目錄",
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
 * 讀取檔案內容（限制長度）
 */
function readFileContent(filePath: string, maxLength: number = 5000): string {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.length > maxLength) {
            return content.slice(0, maxLength) + "\n\n---\n*（內容已截斷...）*";
        }
        return content;
    } catch (error) {
        return `*無法讀取檔案內容: ${error}*`;
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
            // 按修改時間排序（最新的在前）
            mdFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
            setFiles(mdFiles);
            if (mdFiles.length > 0) {
                setSelectedFile(mdFiles[0]);
            }
        } catch (error) {
            showToast({
                style: Toast.Style.Failure,
                title: "無法讀取檔案",
                message: String(error),
            });
        }
        setIsLoading(false);
    }, [rootDir]);

    // 取得所有不重複的資料夾列表
    const folders = useMemo(() => {
        const folderSet = new Set(files.map(f => f.folder));
        return Array.from(folderSet).sort();
    }, [files]);

    // 過濾檔案
    const filteredFiles = useMemo(() => {
        if (filterFolder === "all") return files;
        return files.filter(f => f.folder === filterFolder);
    }, [files, filterFolder]);

    // 取得預覽內容
    const previewContent = useMemo(() => {
        if (!selectedFile) return "";
        return readFileContent(selectedFile.path);
    }, [selectedFile]);

    return (
        <List
            isLoading={isLoading}
            searchBarPlaceholder="搜尋 Markdown 檔案..."
            isShowingDetail
            onSelectionChange={(id) => {
                const file = files.find((f) => f.path === id);
                if (file) setSelectedFile(file);
            }}
            searchBarAccessory={
                <List.Dropdown
                    tooltip="選擇資料夾"
                    storeValue={true}
                    onChange={(newValue) => setFilterFolder(newValue)}
                >
                    <List.Dropdown.Item title="全部資料夾" value="all" icon={Icon.Globe} />
                    <List.Dropdown.Section title="資料夾">
                        {folders.map((folder) => (
                            <List.Dropdown.Item
                                key={folder}
                                title={folder}
                                value={folder}
                                icon={folder === "根目錄" ? Icon.Folder : Icon.Folder}
                            />
                        ))}
                    </List.Dropdown.Section>
                </List.Dropdown>
            }
        >
            {filteredFiles.map((file) => (
                <List.Item
                    key={file.path}
                    id={file.path}
                    icon={Icon.Document}
                    title={file.name}
                    accessories={[
                        { tag: file.folder },
                        { text: formatDate(file.modifiedTime), tooltip: file.modifiedTime.toLocaleString("zh-TW") },
                    ]}
                    detail={
                        <List.Item.Detail
                            markdown={previewContent}
                        />
                    }
                    actions={
                        <ActionPanel>
                            <ActionPanel.Section title="主要">
                                <Action
                                    title="複製檔案內容"
                                    icon={Icon.Clipboard}
                                    onAction={async () => {
                                        const content = fs.readFileSync(file.path, "utf-8");
                                        await Clipboard.copy(content);
                                        await showToast({ style: Toast.Style.Success, title: "已複製內容" });
                                    }}
                                />
                                <Action
                                    title={`用 ${preferences.defaultEditor || "預設應用程式"} 開啟根目錄`}
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
                            <ActionPanel.Section title="其他開啟方式">
                                <Action
                                    title={`用 ${preferences.defaultEditor || "編輯器"} 開啟並定位檔案`}
                                    icon={Icon.Code}
                                    shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                                    onAction={() => {
                                        const editor = preferences.defaultEditor || "Visual Studio Code";
                                        // 使用 open -a 開啟應用程式，並傳遞資料夾和檔案
                                        exec(`open -a "${editor}" "${rootDir}" "${file.path}"`);
                                    }}
                                />
                                <Action.Open title="用系統預設開啟" target={file.path} shortcut={{ modifiers: ["cmd"], key: "o" }} />
                                <Action.ShowInFinder title="在 Finder 中顯示" path={file.path} />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="複製">
                                <Action
                                    title="複製檔案路徑"
                                    icon={Icon.Link}
                                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                                    onAction={async () => {
                                        await Clipboard.copy(file.path);
                                        await showToast({ style: Toast.Style.Success, title: "已複製路徑" });
                                    }}
                                />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="其他">
                                <Action.Trash title="移到垃圾桶" paths={[file.path]} shortcut={{ modifiers: ["cmd"], key: "backspace" }} />
                            </ActionPanel.Section>
                        </ActionPanel>
                    }
                />
            ))}

            {!isLoading && filteredFiles.length === 0 && (
                <List.EmptyView
                    icon={Icon.Document}
                    title="沒有找到 Markdown 檔案"
                    description={filterFolder === "all" ? `根目錄: ${rootDir}` : `資料夾: ${filterFolder}`}
                />
            )}
        </List>
    );
}
