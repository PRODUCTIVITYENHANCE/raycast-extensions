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

interface Preferences {
    rootDirectory: string;
    defaultSubfolder: string;
    defaultEditor: string;
}

interface FolderItem {
    name: string;
    path: string;
    displayName: string;
    isDefault: boolean;
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
 * 清理檔名：移除不允許的字元
 */
function sanitizeFilename(name: string): string {
    // 移除 macOS 不允許的字元 (/ : * ? " < > | \)
    let sanitized = name.replace(/[/:*?"<>|\\]/g, " ");
    // 移除多餘空格
    sanitized = sanitized.replace(/\s+/g, " ").trim();
    // 限制長度為 80 字元
    return sanitized.slice(0, 80);
}

/**
 * 產生唯一的檔案路徑（處理重複檔名）
 */
function getUniqueFilePath(directory: string, filename: string): string {
    const ext = ".md";
    let filePath = path.join(directory, `${filename}${ext}`);

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
 * 遞迴取得所有子資料夾
 */
function getSubfolders(rootDir: string, currentPath: string = "", depth: number = 0): FolderItem[] {
    const preferences = getPreferenceValues<Preferences>();
    const defaultSubfolder = preferences.defaultSubfolder;
    const folders: FolderItem[] = [];

    // 限制遞迴深度
    if (depth > 3) return folders;

    const fullPath = currentPath ? path.join(rootDir, currentPath) : rootDir;

    try {
        const items = fs.readdirSync(fullPath, { withFileTypes: true });

        for (const item of items) {
            // 跳過隱藏資料夾
            if (item.name.startsWith(".")) continue;

            if (item.isDirectory()) {
                const relativePath = currentPath ? path.join(currentPath, item.name) : item.name;
                const isDefault = relativePath === defaultSubfolder;
                const indent = "  ".repeat(depth);

                folders.push({
                    name: item.name,
                    path: relativePath,
                    displayName: isDefault ? `⭐ ${relativePath}（預設）` : `${indent}📁 ${relativePath}`,
                    isDefault,
                });

                // 遞迴取得子資料夾
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
    const [clipboardText, setClipboardText] = useState<string>("");
    const [content, setContent] = useState<string>("");
    const [selectedFolder, setSelectedFolder] = useState<string>("");
    const [customFilename, setCustomFilename] = useState<string>("");

    const preferences = getPreferenceValues<Preferences>();
    const rootDir = expandHome(preferences.rootDirectory);
    const defaultSubfolder = preferences.defaultSubfolder;
    const defaultEditor = preferences.defaultEditor;

    // 載入剪貼簿內容和資料夾列表
    useEffect(() => {
        async function init() {
            try {
                // 讀取剪貼簿
                const text = (await Clipboard.readText()) || "";
                setClipboardText(text);
                setContent(text);

                // 讀取資料夾列表
                const subfolders = getSubfolders(rootDir);

                // 將預設資料夾排到最前面
                const sortedFolders = subfolders.sort((a, b) => {
                    if (a.isDefault) return -1;
                    if (b.isDefault) return 1;
                    return 0;
                });

                setFolders(sortedFolders);

                // 設定初始選擇的資料夾
                if (defaultSubfolder) {
                    setSelectedFolder(defaultSubfolder);
                } else {
                    setSelectedFolder("__root__");
                }
            } catch (error) {
                showToast({
                    style: Toast.Style.Failure,
                    title: "初始化失敗",
                    message: String(error),
                });
            }
            setIsLoading(false);
        }
        init();
    }, [rootDir]);

    /**
     * 儲存檔案的核心函數，回傳儲存的檔案路徑
     */
    const saveFile = async (values: { folder: string; content: string; customFilename: string }): Promise<string | null> => {
        const textContent = values.content.trim();

        if (!textContent) {
            await showToast({
                style: Toast.Style.Failure,
                title: "內容不能為空！",
            });
            return null;
        }

        // 決定目標資料夾
        let targetDir: string;
        if (values.folder === "__root__") {
            targetDir = rootDir;
        } else {
            targetDir = path.join(rootDir, values.folder);
        }

        // 確保目標資料夾存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 決定檔名：優先使用自定義檔名，否則用第一行
        let filename: string;
        const customName = values.customFilename.trim();

        if (customName) {
            // 使用自定義檔名
            filename = sanitizeFilename(customName);
        } else {
            // 取得第一行作為檔名
            const lines = textContent.split("\n");
            const firstLine = lines[0].trim();
            filename = sanitizeFilename(firstLine);
        }

        // 如果檔名為空，使用時間戳記
        if (!filename) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
            filename = `note-${timestamp}`;
        }

        // 取得唯一的檔案路徑
        const filePath = getUniqueFilePath(targetDir, filename);

        try {
            // 寫入檔案
            fs.writeFileSync(filePath, textContent, "utf-8");
            return filePath;
        } catch (error) {
            await showToast({
                style: Toast.Style.Failure,
                title: "儲存失敗！",
                message: String(error),
            });
            return null;
        }
    };

    const handleSubmit = async (values: { folder: string; content: string; customFilename: string }) => {
        const filePath = await saveFile(values);
        if (filePath) {
            const savedFilename = path.basename(filePath);
            const folderName = values.folder === "__root__" ? "根目錄" : values.folder;
            await showHUD(`✅ 已儲存: ${savedFilename} → ${folderName}`);
            await popToRoot();
        }
    };

    const handleSubmitAndOpen = async (values: { folder: string; content: string; customFilename: string }) => {
        const filePath = await saveFile(values);
        if (filePath) {
            const savedFilename = path.basename(filePath);
            const folderName = values.folder === "__root__" ? "根目錄" : values.folder;
            const editorName = defaultEditor || "預設應用程式";

            try {
                // 用指定的編輯器打開檔案
                if (defaultEditor) {
                    await open(filePath, defaultEditor);
                } else {
                    await open(filePath);
                }
                await showHUD(`✅ 已儲存並打開: ${savedFilename} → ${editorName}`);
            } catch (error) {
                await showHUD(`✅ 已儲存: ${savedFilename}（無法用 ${editorName} 打開）`);
            }
            await popToRoot();
        }
    };

    return (
        <Form
            isLoading={isLoading}
            actions={
                <ActionPanel>
                    <Action.SubmitForm
                        title="儲存 Markdown"
                        icon={Icon.Document}
                        onSubmit={handleSubmit}
                    />
                    <Action.SubmitForm
                        title={`儲存並用 ${defaultEditor || "預設程式"} 打開`}
                        icon={Icon.AppWindowSidebarRight}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                        onSubmit={handleSubmitAndOpen}
                    />
                </ActionPanel>
            }
        >
            <Form.Dropdown
                id="folder"
                title="選擇資料夾"
                value={selectedFolder}
                onChange={setSelectedFolder}
            >
                <Form.Dropdown.Item
                    value="__root__"
                    title={defaultSubfolder ? "📁 根目錄" : "📁 根目錄（預設）"}
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
                title="自定義檔名"
                placeholder="留空則使用第一行作為檔名"
                value={customFilename}
                onChange={setCustomFilename}
            />

            <Form.TextArea
                id="content"
                title="內容"
                placeholder="輸入 Markdown 內容..."
                value={content}
                onChange={setContent}
                enableMarkdown
            />

            <Form.Description
                title="說明"
                text="可輸入自定義檔名（不需要 .md 副檔名）。若留空，則使用內容第一行作為檔名。若第一行也為空，將使用時間戳記命名。"
            />
        </Form>
    );
}
