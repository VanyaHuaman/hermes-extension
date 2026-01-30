# Hermes Installation Guide

Quick setup guide to get Hermes running in 5 minutes.

## Prerequisites

- Google Chrome or Chromium-based browser
- Anthropic API key ([Get one here](https://console.anthropic.com/))

## Step 1: Generate Icons (2 minutes)

1. Open `icons/create-icons.html` in Chrome:
   ```bash
   open icons/create-icons.html
   ```

2. Click the **"Download All Icons"** button

3. Three PNG files will download:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

4. Move these files into the `icons/` folder (they should be in the same directory as `create-icons.html`)

## Step 2: Load Extension in Chrome (1 minute)

1. Open Chrome and go to: `chrome://extensions/`

2. Enable **Developer mode**:
   - Toggle switch in top-right corner

3. Click **"Load unpacked"**

4. Navigate to and select the **hermes-extension** folder
   - If you cloned from GitHub: select the cloned `hermes-extension/` directory
   - Browse to wherever you downloaded/cloned the extension

5. Hermes should now appear in your extensions!

## Step 3: Configure API Key (1 minute)

1. Click the Hermes extension icon in Chrome toolbar (⚡)

2. Click the settings icon (⚙️) in the top-right

3. Or right-click extension icon → **Options**

4. Enter your Anthropic API key:
   ```
   sk-ant-api03-...
   ```

5. Click **"Save API Key"**

6. You should see "API key saved successfully!"

## Step 4: Index Your First Site (1 minute)

### Method A: Index Single Page

1. Go to any website (try Wikipedia, documentation site, etc.)
2. Click the Hermes extension icon (⚡)
3. Click **"📄 Index This Page"**
4. Page content will be indexed

### Method B: Crawl Entire Site

1. Go to a website you want to index
2. Click the Hermes extension icon (⚡)
3. Click **"🕷️ Crawl Site"**
4. Enter how many pages to crawl (e.g., 20)
5. Wait while Hermes crawls (you'll see progress)
6. Done! All pages indexed

## Step 5: Ask Questions! (ongoing)

1. Click the Hermes extension icon
2. Type a question about the content you indexed
3. Press Enter or click "Send"
4. Get an AI answer with source citations!

---

## Example Workflow

Let's index Python documentation and ask questions:

1. Go to `https://docs.python.org/3/`
2. Click Hermes icon → "Crawl Site"
3. Enter `30` pages
4. Wait 1-2 minutes
5. Ask: "How do I use list comprehensions?"
6. Get answer with links to relevant docs!

---

## Troubleshooting

### Icons Missing
If extension won't load, check that all 3 icon files exist:
```bash
ls icons/
# Should show: icon16.png icon48.png icon128.png
```

### API Key Error
Make sure your API key:
- Starts with `sk-ant-`
- Is from console.anthropic.com
- Has API access enabled

### Can't Crawl
Some sites block crawling. Try:
- Increase crawl delay in settings (⚙️ → Crawl Settings)
- Use "Index This Page" instead
- Check if site requires login

### No Results
If questions return no results:
- Make sure pages are indexed (check stats in popup)
- Try more specific questions
- View indexed domains (click "Domains" button)

### Extension Not Working After Install
If the extension loads but features don't work:
- Go to `chrome://extensions/`
- Click the **🔄 reload icon** on Hermes extension
- Sometimes Chrome needs a reload after first install
- If still having issues, restart Chrome completely

---

## Quick Tips

💡 **Multi-Domain Search**: Click "Domains" to see all indexed sites, remove old ones

💡 **Filter by Domain**: Use dropdown to search within specific site

💡 **Export Data**: Settings → "Export Data (JSON)" to backup your index

💡 **Clear Storage**: If running out of space, remove old domains

---

## Next Steps

- Try indexing your company's documentation
- Index multiple news sites and compare coverage
- Create a knowledge base from blog posts
- Use with authenticated sites (works with your browser cookies!)

**Need help?** See [README.md](README.md) for full documentation.
