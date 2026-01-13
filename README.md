# Add MD to Folder

快速將剪貼簿內容或輸入的文字儲存為 Markdown 檔案到指定資料夾。專為筆記工作流設計的 Raycast Extension。

---

## ✨ 功能特色

| 指令 | 說明 |
|------|------|
| **Add md to Folder** | 快速將剪貼簿內容儲存到預設資料夾（無需選擇） |
| **Add md (Select Folder)** | 選擇子資料夾後儲存，支援自定義檔名 |
| **Browse Markdown Files** | 瀏覽根目錄中所有的 Markdown 檔案 |
| **Append to Markdown** | 將文字附加到現有的 Markdown 檔案末尾 |

### 🎯 核心亮點
- 📋 自動讀取剪貼簿內容
- 📁 支援多層子資料夾選擇
- ✏️ 可自定義檔名（留空則使用第一行作為檔名）
- ⭐ 可設定預設子資料夾，加速常用操作
- 🔄 自動處理重複檔名（自動加上編號）

---

## 📦 安裝方式

### 方法一：從原始碼安裝

```bash
# 1. 解壓縮（如果是 zip 檔案）
unzip add-md-to-folder.zip -d add-md-to-folder

# 2. 進入資料夾
cd add-md-to-folder

# 3. 安裝依賴
npm install

# 4. 編譯並安裝到 Raycast
npm run build
```

安裝完成後，在 Raycast 中搜尋 `Add md` 即可使用！

### 方法二：開發模式

```bash
npm install
npm run dev
```

開發模式支援熱重載，方便即時測試修改。

---

## ⚙️ 設定選項

在 Raycast 中開啟 Extension 設定，可以調整以下選項：

| 設定 | 說明 | 預設值 |
|------|------|--------|
| **Root Directory** | 存放 Markdown 檔案的根目錄 | `~/Desktop` |
| **Default Subfolder** | 預設子資料夾（留空表示直接存到根目錄） | 空 |
| **Default Editor** | 開啟 Markdown 檔案的預設應用程式 | `Visual Studio Code` |

---

## 🚀 使用方式

### 快速儲存（Add md to Folder）
1. 複製任意文字到剪貼簿
2. 開啟 Raycast，輸入 `Add md to Folder`
3. 自動儲存到預設資料夾 ✅

### 選擇資料夾儲存（Add md Select Folder）
1. 開啟 Raycast，輸入 `Add md Select Folder`
2. 選擇目標子資料夾
3. （可選）輸入自定義檔名
4. 編輯或確認內容
5. 按 `Enter` 儲存 ✅

### 檔名規則
1. **有輸入自定義檔名** → 使用自定義檔名
2. **沒有輸入，但內容第一行有文字** → 使用第一行作為檔名
3. **都沒有** → 使用時間戳記命名（如 `note-20260113123000`）

---

## 📝 License

MIT License


