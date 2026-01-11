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

interface Preferences {
    rootDirectory: string;
    defaultSubfolder: string;
}

interface MarkdownFile {
    name: string;
    path: string;
    folder: string;
    modifiedTime: Date;
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
 * 格式化時間（簡短版本）
 */
function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) {
            const minutes = Math.floor(diff / (1000 * 60));
            return minutes <= 1 ? "剛剛" : `${minutes}分鐘前`;
        }
        return `${hours}小時前`;
    }
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;

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
                // 讀取剪貼板內容
                const clipboard = await Clipboard.readText();
                setContent(clipboard || "");

                // 讀取 Markdown 檔案
                const mdFiles = getMarkdownFiles(rootDir);
                // 按修改時間排序（最新的在前）
                mdFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
                setFiles(mdFiles);

                // 預設選擇第一個檔案
                if (mdFiles.length > 0) {
                    setSelectedFile(mdFiles[0].path);
                }
            } catch (error) {
                showToast({
                    style: Toast.Style.Failure,
                    title: "無法讀取檔案",
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
                title: "請選擇檔案！",
            });
            return;
        }

        if (!content || content.trim() === "") {
            await showToast({
                style: Toast.Style.Failure,
                title: "內容不能為空！",
            });
            return;
        }

        const file = files.find((f) => f.path === selectedFile);
        if (!file) {
            await showToast({
                style: Toast.Style.Failure,
                title: "找不到選擇的檔案！",
            });
            return;
        }

        try {
            // 讀取現有內容
            const existingContent = fs.readFileSync(file.path, "utf-8");

            // 建立要附加的內容
            let appendContent = "";

            // 確保檔案結尾有換行
            if (existingContent && !existingContent.endsWith("\n")) {
                appendContent += "\n";
            }

            // 加入分隔線
            if (addSeparator) {
                appendContent += "\n---\n\n";
            } else {
                appendContent += "\n";
            }

            // 加入時間戳記
            if (addTimestamp) {
                const now = new Date();
                const timestamp = now.toLocaleString("zh-TW", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                appendContent += `*${timestamp}*\n\n`;
            }

            // 加入內容
            appendContent += content;

            // 附加到檔案
            fs.appendFileSync(file.path, appendContent, "utf-8");

            await showHUD(`✅ 已附加到: ${file.name}.md`);
            await popToRoot();
        } catch (error) {
            await showToast({
                style: Toast.Style.Failure,
                title: "附加失敗！",
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
                    <Action.SubmitForm title="附加內容" icon={Icon.Plus} onSubmit={handleSubmit} />
                </ActionPanel>
            }
        >
            <Form.Dropdown
                id="file"
                title="選擇檔案"
                value={selectedFile}
                onChange={setSelectedFile}
            >
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
                title="要附加的內容"
                placeholder="輸入要附加的文字..."
                value={content}
                onChange={setContent}
                enableMarkdown
            />

            <Form.Separator />

            <Form.Checkbox
                id="addSeparator"
                label="加入分隔線 (---)"
                value={addSeparator}
                onChange={setAddSeparator}
            />
            <Form.Checkbox
                id="addTimestamp"
                label="加入時間戳記"
                value={addTimestamp}
                onChange={setAddTimestamp}
            />
        </Form>
    );
}
