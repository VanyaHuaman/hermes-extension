// Hermes - RAG (Retrieval-Augmented Generation)
// Handles search and AI question answering

export class HermesRAG {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
  }

  // Search for relevant pages using keyword matching
  searchPages(query, pages, limit = 5, domain = null) {
    // Filter by domain if specified
    let searchPool = pages;
    if (domain) {
      searchPool = pages.filter(p => p.domain === domain);
    }

    // Extract keywords from query
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !this.isStopWord(w));

    if (keywords.length === 0) {
      // No valid keywords, return most recent pages
      return searchPool
        .sort((a, b) => b.indexedAt - a.indexedAt)
        .slice(0, limit);
    }

    // Score each page
    const scored = searchPool.map(page => {
      const pageText = (page.title + ' ' + page.content).toLowerCase();
      let score = 0;

      keywords.forEach(keyword => {
        // Exact keyword matches
        const matches = (pageText.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 2;

        // Title matches are worth more
        const titleMatches = (page.title.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
        score += titleMatches * 5;

        // Partial matches
        const words = pageText.split(/\s+/);
        words.forEach(word => {
          if (word.includes(keyword)) {
            score += 0.5;
          }
        });
      });

      return { page, score };
    });

    // Return top scored pages
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.page);
  }

  // Ask question using Claude API
  async ask(question, pages, domain = null) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    if (pages.length === 0) {
      throw new Error('No pages indexed. Please index some pages first.');
    }

    // Search for relevant pages
    const relevantPages = this.searchPages(question, pages, 5, domain);

    if (relevantPages.length === 0) {
      throw new Error('No relevant pages found. Try a different question or index more pages.');
    }

    // Build context
    const context = this.buildContext(relevantPages);

    // Call Claude API
    const answer = await this.callClaude(question, context);

    // Extract sources
    const sources = relevantPages.map(page => ({
      url: page.url,
      title: page.title,
      domain: page.domain
    }));

    return {
      answer,
      sources,
      contextUsed: relevantPages.length
    };
  }

  // Build context from pages
  buildContext(pages) {
    let context = '';

    pages.forEach((page, i) => {
      context += `\n--- Source ${i + 1} ---\n`;
      context += `URL: ${page.url}\n`;
      context += `Title: ${page.title}\n`;
      context += `Domain: ${page.domain}\n`;

      // Truncate content to avoid token limits
      const maxContentLength = 2000;
      const content = page.content.substring(0, maxContentLength);
      context += `Content: ${content}\n`;

      if (page.content.length > maxContentLength) {
        context += `[... content truncated]\n`;
      }
    });

    return context;
  }

  // Call Claude API
  async callClaude(question, context) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `You are Hermes, an intelligent assistant that helps users understand website content.

Based on the following context from indexed web pages, answer the user's question. Provide a clear, helpful answer and reference the sources when relevant.

Context:
${context}

User Question: ${question}

Please provide a helpful, accurate answer based on the context above. If the answer isn't clearly in the context, say so and offer your best interpretation. Always be honest about the limitations of the available information.`
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Check if word is a stop word
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this',
      'from', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may',
      'might', 'must', 'can', 'what', 'when', 'where', 'who', 'how', 'why'
    ]);

    return stopWords.has(word);
  }
}
