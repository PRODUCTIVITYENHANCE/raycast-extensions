# Add Md to Folder

Quickly save clipboard content or input text as Markdown files to a specified folder. A Raycast Extension designed for note-taking workflows.


---

## ✨ Features

| Command | Description |
|---------|-------------|
| **Add Md to Folder** | Quickly save clipboard content to default folder (no selection needed) |
| **Add Md (Select Folder)** | Select a subfolder before saving, with custom filename support |
| **Browse Markdown Files** | Browse all Markdown files in the root directory |
| **Append to Markdown** | Append text to an existing Markdown file |

### 🎯 Highlights
- 📋 Auto-read clipboard content
- 📁 Multi-level subfolder selection
- ✏️ Custom filename (leave empty to use the first line)
- ⭐ Set default subfolder for faster workflow
- 🔄 Auto-handle duplicate filenames (add numbers)

---

## 📦 Installation

### From Source

```bash
# Clone or extract the extension
cd add-md-to-folder

# Install dependencies
npm install

# Build and install to Raycast
npm run build
```

After installation, search for `Add Md` in Raycast to start using!

### Development Mode

```bash
npm install
npm run dev
```

Development mode supports hot reload for instant testing.

---

## ⚙️ Settings

Open the Extension settings in Raycast to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Root Directory** | Root directory to store Markdown files | `~/Desktop` |
| **Default Subfolder** | Default subfolder (leave empty to save to root) | Empty |
| **Default Editor** | Default application to open Markdown files | `Visual Studio Code` |

---

## 🚀 Usage

### Quick Save (Add Md to Folder)
1. Copy any text to clipboard
2. Open Raycast, type `Add Md to Folder`
3. Auto-saved to default folder ✅

### Save with Folder Selection (Add Md Select Folder)
1. Open Raycast, type `Add Md Select Folder`
2. Select target subfolder
3. (Optional) Enter custom filename
4. Edit or confirm content
5. Press `Enter` to save ✅
6. Press `Cmd + Shift + Enter` to save and open in editor ✅

### Filename Rules
1. **Custom filename provided** → Use custom filename
2. **No custom filename, but first line has text** → Use first line as filename
3. **Both empty** → Use timestamp (e.g., `note-20260113123000`)

---

## 📝 License

MIT License
