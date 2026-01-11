import { Action, ActionPanel, List, getPreferenceValues, Icon, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import { saveMarkdownFile } from "./add-md-to-folder";

interface Preferences {
    rootDirectory: string;
    defaultSubfolder: string;
}

interface FolderItem {
    name: string;
    path: string;
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

                folders.push({
                    name: item.name,
                    path: relativePath,
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
    const preferences = getPreferenceValues<Preferences>();
    const rootDir = expandHome(preferences.rootDirectory);
    const defaultSubfolder = preferences.defaultSubfolder;

    useEffect(() => {
        try {
            const subfolders = getSubfolders(rootDir);
            setFolders(subfolders);
        } catch (error) {
            showToast({
                style: Toast.Style.Failure,
                title: "無法讀取資料夾",
                message: String(error),
            });
        }
        setIsLoading(false);
    }, [rootDir]);

    const handleSave = async (folderPath?: string) => {
        await saveMarkdownFile(folderPath);
    };

    // 分離預設資料夾和其他資料夾
    const defaultFolder = folders.find((f) => f.isDefault);
    const otherFolders = folders.filter((f) => !f.isDefault);

    return (
        <List isLoading={isLoading} searchBarPlaceholder="搜尋資料夾...">
            {/* 預設資料夾（最上面） */}
            {defaultFolder && (
                <List.Item
                    icon={Icon.Star}
                    title={`⭐ ${defaultFolder.path}`}
                    subtitle="（預設）"
                    accessories={[{ text: "按 Enter 快速儲存" }]}
                    actions={
                        <ActionPanel>
                            <Action title={`儲存到 ${defaultFolder.name}`} onAction={() => handleSave(defaultFolder.path)} />
                        </ActionPanel>
                    }
                />
            )}

            {/* 如果沒有設定預設資料夾，顯示根目錄在最上面 */}
            {!defaultSubfolder && (
                <List.Item
                    icon={Icon.Folder}
                    title="📁 根目錄"
                    subtitle={rootDir}
                    accessories={[{ text: "按 Enter 快速儲存" }]}
                    actions={
                        <ActionPanel>
                            <Action title="儲存到根目錄" onAction={() => handleSave()} />
                        </ActionPanel>
                    }
                />
            )}

            {/* 其他子資料夾 */}
            <List.Section title="其他資料夾">
                {otherFolders.map((folder) => (
                    <List.Item
                        key={folder.path}
                        icon={Icon.Folder}
                        title={folder.path}
                        accessories={[{ text: folder.name }]}
                        actions={
                            <ActionPanel>
                                <Action title={`儲存到 ${folder.name}`} onAction={() => handleSave(folder.path)} />
                            </ActionPanel>
                        }
                    />
                ))}
            </List.Section>

            {/* 根目錄選項（如果有設定預設資料夾，則放在下面） */}
            {defaultSubfolder && (
                <List.Section title="根目錄">
                    <List.Item
                        icon={Icon.Folder}
                        title="📁 根目錄"
                        subtitle={rootDir}
                        accessories={[{ text: "直接存到根目錄" }]}
                        actions={
                            <ActionPanel>
                                <Action title="儲存到根目錄" onAction={() => handleSave()} />
                            </ActionPanel>
                        }
                    />
                </List.Section>
            )}

            {/* 沒有子資料夾時的提示 */}
            {!isLoading && folders.length === 0 && !defaultSubfolder && (
                <List.EmptyView
                    icon={Icon.Folder}
                    title="沒有找到子資料夾"
                    description={`根目錄: ${rootDir}`}
                />
            )}
        </List>
    );
}
