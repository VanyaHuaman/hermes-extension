# ⚡ Hermes - Universal Site Assistant

A Chrome extension that lets you ask questions about ANY website using AI. Index pages, ask questions, get answers with source citations.

![Hermes Extension](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **Universal**: Works on ANY website, not just one domain
- **Multi-Domain**: Index and search across multiple websites
- **Smart Search**: Keyword-based relevance matching
- **AI-Powered**: Uses Claude Sonnet 4.5 for intelligent answers
- **Source Citations**: Every answer includes links to original pages
- **Privacy First**: All data stored locally in Chrome
- **No Server**: Works entirely in your browser
- **Cookie Support**: Handles authenticated sites automatically

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/VanyaHuaman/hermes-extension.git
cd hermes-extension
```

**Note:** Icons are already included - no need to generate them!

### 2. Load Extension in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `hermes-extension` folder you just cloned

### 3. Configure API Key

1. Click the Hermes extension icon
2. Click the settings icon (⚙️)
3. Enter your Anthropic API key from [console.anthropic.com](https://console.anthropic.com/)
4. Click "Save API Key"

### 4. Start Using

1. Navigate to any website
2. Click the Hermes extension icon
3. Click "Index This Page" or "Crawl Site"
4. Ask questions about the content!

## 📖 How It Works

### Indexing
1. Hermes extracts clean text content from web pages
2. Removes ads, navigation, scripts, and other noise
3. Stores pages with metadata (URL, title, domain, timestamp)
4. Organizes by domain for easy management

### Searching
1. User asks a question
2. Hermes uses keyword matching to find relevant pages
3. Ranks pages by relevance score
4. Returns top 5 most relevant pages

### Answering
1. Relevant page content is sent to Claude API
2. Claude generates a helpful answer based on context
3. Answer includes citations to source pages
4. User can click sources to open original pages

## 🎯 Use Cases

### Documentation Sites
Index technical documentation and ask specific questions:
- "How do I configure the API key?"
- "What are the rate limits?"

### News/Blogs
Index articles and query content:
- "What did they say about the new feature?"
- "When was this released?"

### Company Portals (with auth)
Index internal sites (Hermes uses your browser cookies):
- "How can I put in for vacation?"
- "What's the expense policy?"

### Research
Index multiple sources and cross-reference:
- "What do these sites say about X?"
- "Compare the approaches"

## 🏗️ Architecture

```
hermes-extension/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Main orchestrator
├── lib/
│   ├── storage.js         # Data management
│   ├── crawler.js         # Web crawling
│   └── rag.js             # Search & AI
├── popup/
│   ├── popup.html         # Chat interface
│   ├── popup.css          # Styles
│   └── popup.js           # UI logic
├── options/
│   ├── options.html       # Settings page
│   ├── options.css        # Settings styles
│   └── options.js         # Settings logic
├── content/
│   └── content.js         # Content script
└── icons/
    ├── icon16.png         # Extension icons
    ├── icon48.png
    └── icon128.png
```

### Data Flow

1. **Crawl**: User clicks "Crawl Site" → Background worker navigates pages → Extracts content → Saves to storage
2. **Index**: Content stored with domain metadata in Chrome local storage
3. **Query**: User asks question → RAG searches indexed pages → Sends top results to Claude → Returns answer with sources
4. **Display**: Popup shows answer with clickable source links

## ⚙️ Configuration

### API Key
- Required for AI-powered answers
- Get from [console.anthropic.com](https://console.anthropic.com/)
- Stored locally in Chrome (never sent anywhere except Anthropic API)

### Crawl Settings
- **Max Pages**: 1-100 pages per crawl (default: 50)
- **Crawl Delay**: 500-10000ms between pages (default: 2000ms)

### Storage
- All data stored in Chrome's local storage
- Average: ~1-2KB per page
- Storage limit: ~5MB (approximately 2500-5000 pages)

## 🔒 Privacy & Security

- **Local Storage**: All indexed content stays in your browser
- **No Tracking**: No analytics, no telemetry
- **Cookie Isolation**: Uses your browser's cookies, doesn't store them
- **API Key**: Stored locally, only sent to Anthropic API
- **Open Source**: Full transparency, inspect the code

## 🛠️ Development

### Project Structure

**Core Libraries** (`lib/`):
- `storage.js`: Manages domains, pages, chat history in Chrome storage
- `crawler.js`: Extracts content, navigates pages, handles links
- `rag.js`: Keyword search, relevance scoring, Claude API integration

**User Interface**:
- `popup/`: Main chat interface (420x600px)
- `options/`: Settings page for configuration

**Background**:
- `service-worker.js`: Handles all messaging, orchestrates crawling and queries

### Local Development

1. Make changes to any files
2. Go to `chrome://extensions/`
3. Click refresh icon (🔄) on Hermes extension
4. Test changes

**Important:** After first loading the extension, you may need to reload it or restart Chrome for script injection to work properly.

**Note on Claude API:** The extension uses the `anthropic-dangerous-direct-browser-access` header required for browser-based API calls. This is documented in Anthropic's API docs.

### Adding Features

**New Crawl Strategy:**
Edit `lib/crawler.js` → `HermesCrawler` class

**New Search Algorithm:**
Edit `lib/rag.js` → `searchPages()` method

**UI Changes:**
Edit `popup/popup.html` and `popup/popup.css`

## 📊 Performance

### Crawling
- **Speed**: ~2 seconds per page (configurable)
- **Limit**: Up to 100 pages per crawl
- **Memory**: Low impact, uses browser tab for rendering

### Searching
- **Speed**: <100ms for keyword search
- **Accuracy**: Keyword-based ranking (no embeddings for speed)
- **Context**: Top 5 pages sent to Claude

### API Usage
- **Cost**: ~$0.01-0.03 per question (Claude Sonnet 4.5)
- **Tokens**: Typically 2000-4000 tokens per query
- **Rate Limits**: Respects Anthropic API limits

## 🐛 Troubleshooting

**Extension won't load:**
- Ensure all 3 icon files exist in `icons/` folder
- Check Chrome console for errors

**"API key not configured":**
- Open settings (⚙️ icon)
- Enter your Anthropic API key
- Must start with `sk-ant-`

**Crawl fails:**
- Some sites block automated crawling
- Try reducing crawl speed (increase delay)
- Try "Index This Page" instead

**No relevant results:**
- Index more pages from the site
- Try different keywords in your question
- Check that pages were actually indexed (view Domains panel)

**Chat history disappears:**
- History stored in Chrome local storage
- Clearing browser data removes history
- Use "Export Data" to backup

## 🤝 Contributing

Contributions welcome! This is a prototype/reference implementation.

**Ideas for Improvement:**
- [ ] Vector embeddings for better search
- [ ] Automatic re-crawling/updates
- [ ] Page change detection
- [ ] Better duplicate detection
- [ ] Sitemap.xml support
- [ ] PDF indexing
- [ ] Image OCR
- [ ] Multi-language support

## 📄 License

MIT License - feel free to modify and distribute

## 🙏 Credits

- Built with [Claude](https://www.anthropic.com/)
- Powered by [Anthropic API](https://www.anthropic.com/api)
- Icon: Lightning bolt (messenger of the gods)

## 📞 Support

- **Issues**: Report bugs or request features via GitHub issues
- **Documentation**: See this README
- **API Help**: [Anthropic Documentation](https://docs.anthropic.com/)

---

**Made with ⚡ by Claude Code**
