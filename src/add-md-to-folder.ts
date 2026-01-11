import { Clipboard, showHUD, getPreferenceValues, showToast, Toast } from "@raycast/api";
import * as fs from "fs";
import * as path from "path";

interface Preferences {
  rootDirectory: string;
  defaultSubfolder: string;
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
 * 展開 ~ 為 home 目錄
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith("~")) {
    return path.join(process.env.HOME || "", filepath.slice(1));
  }
  return filepath;
}

/**
 * 主要的儲存邏輯
 */
export async function saveMarkdownFile(targetFolder?: string): Promise<void> {
  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.rootDirectory);

  // 決定目標資料夾
  let targetDir: string;
  if (targetFolder) {
    targetDir = path.join(rootDir, targetFolder);
  } else if (preferences.defaultSubfolder) {
    targetDir = path.join(rootDir, preferences.defaultSubfolder);
  } else {
    targetDir = rootDir;
  }

  // 確保目標資料夾存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 從剪貼板讀取內容
  const content = await Clipboard.readText();

  if (!content || content.trim() === "") {
    await showToast({
      style: Toast.Style.Failure,
      title: "剪貼板是空的！",
    });
    return;
  }

  // 取得第一行作為檔名
  const lines = content.split("\n");
  const firstLine = lines[0].trim();

  // 清理檔名
  let filename = sanitizeFilename(firstLine);

  // 如果第一行為空，使用時間戳記
  if (!filename) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
    filename = `note-${timestamp}`;
  }

  // 取得唯一的檔案路徑
  const filePath = getUniqueFilePath(targetDir, filename);

  try {
    // 寫入檔案
    fs.writeFileSync(filePath, content, "utf-8");

    const savedFilename = path.basename(filePath);
    const folderName = targetFolder || preferences.defaultSubfolder || "根目錄";

    await showHUD(`✅ 已儲存: ${savedFilename} → ${folderName}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "儲存失敗！",
      message: String(error),
    });
  }
}

/**
 * 快速儲存命令（使用預設資料夾）
 */
export default async function Command() {
  await saveMarkdownFile();
}
