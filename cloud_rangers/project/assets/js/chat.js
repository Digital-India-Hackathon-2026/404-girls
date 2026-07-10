// AI Chat JavaScript
// Handles chat interface, message sending, and simulated AI responses

document.addEventListener('DOMContentLoaded', function () {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');
    const sendBtn = document.getElementById('sendBtn');

    // Auto-resize textarea
    if (chatInput) {
        chatInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';

            // Enable/disable send button
            sendBtn.disabled = this.value.trim() === '';
        });

        // Initial state
        sendBtn.disabled = true;
    }

    // Handle form submission
    if (chatForm) {
        chatForm.addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage();
        });
    }

    // Handle Enter key (Shift+Enter for new line)
    if (chatInput) {
        chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.value.trim() !== '') {
                    sendMessage();
                }
            }
        });
    }
});

// Send message function
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        // Read context
        let context = null;
        const savedCtx = localStorage.getItem("lps_ai_context");
        if (savedCtx) {
            context = JSON.parse(savedCtx);
        }

        const response = await fetch("http://127.0.0.1:5000/api/chat", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                context: context
            })
        });

        if (!response.ok) {
            throw new Error(`Server error (${response.status})`);
        }

        const data = await response.json();

        hideTypingIndicator();
        if (data.response) {
            addMessage(data.response, 'ai');
        } else {
            addMessage("I'm sorry, I encountered an error. Please try again.", 'ai');
        }

    } catch (err) {
        console.error("Chat error:", err);
        hideTypingIndicator();
        addMessage("Sorry, I could not connect to the AI engine right now. Please check your connection or try again later.", 'ai');
    }
}

// Add message to chat
function addMessage(text, type) {
    const chatMessages = document.getElementById('chatMessages');
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${type}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = type === 'ai' ? '<i class="bi bi-robot"></i>' : '<i class="bi bi-person-fill"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Convert line breaks to <br> and format text (simple markdown)
    const formattedText = formatMessageText(text);
    bubble.innerHTML = formattedText;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = 'Just now';

    content.appendChild(bubble);
    content.appendChild(time);

    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(content);

    chatMessages.appendChild(messageWrapper);

    // Scroll to bottom
    scrollToBottom();
}

// Format message text
function formatMessageText(text) {
    if (!text) return "";

    // Headers (### text)
    text = text.replace(/^### (.*$)/gm, '<h4>$1</h4>');
    text = text.replace(/^## (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^# (.*$)/gm, '<h2>$1</h2>');

    // Bold **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italics *text*
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code blocks
    text = text.replace(/```([\s\S]*?)```/g, '<div class="code-block">$1</div>');
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, '<a href="$1" target="_blank" class="chat-link">$1</a>');

    // Convert numbered lists
    text = text.replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>');

    // Convert bullet points
    text = text.replace(/^[\-\*]\s+(.*$)/gm, '<li>$1</li>');

    // Wrap consecutive list items in <ul> or <ol> (simplified hack: just let browser render lists if styled properly, or use br)

    // Convert line breaks (excluding existing html block tags)
    text = text.replace(/\n\n/g, '<br><br>');
    text = text.replace(/(?<!<br>)\n(?!<br>)/g, '<br>');
    text = text.replace(/<br><li>/g, '<li>');
    text = text.replace(/<\/li><br>/g, '</li>');

    return text;
}

// Show typing indicator
function showTypingIndicator() {
    let typingIndicator = document.getElementById('typingIndicator');
    const chatMessages = document.getElementById('chatMessages');

    if (typingIndicator && chatMessages) {
        // Move it to the very bottom of the chat list so it scrolls naturally
        chatMessages.appendChild(typingIndicator);
        typingIndicator.style.display = 'block';
        scrollToBottom();
    }
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
}

// Quick message function
function sendQuickMessage(message) {
    const chatInput = document.getElementById('chatInput');
    chatInput.value = message;
    chatInput.dispatchEvent(new Event('input'));
    sendMessage();
}

// Database Integration Comments
/*
    AI CHAT DATABASE INTEGRATION:
    
    In production, this chat would connect to:
    
    1. VECTOR DATABASE for RAG (Retrieval Augmented Generation):
       - Store embeddings of product information, ingredient data
       - Use for context-aware responses
       - Example: Pinecone, Weaviate, or PostgreSQL with pgvector
    
    2. PRODUCT CONTEXT:
       - If user asks about current product, fetch from session/URL params
       - Query product details, ingredients, compliance status
       - Provide specific answers based on actual product data
    
    3. USER PROFILE CONTEXT:
       - Include user allergies, preferences in AI prompts
       - Personalize warnings and recommendations
       - Query: SELECT * FROM user_health_profiles WHERE user_id = {id}
    
    4. KNOWLEDGE BASE:
       - Store in 'knowledge_articles' table
       - Categories: ingredients, additives, regulations, health concerns
       - Use for consistent, verified information
    
    5. CHAT HISTORY:
       - Store in 'chat_messages' table for context and user support
       - Schema: id, user_id, message, response, timestamp
    
    6. API INTEGRATION:
       - In production: Call Claude API or other LLM
       - Include system prompts with regulatory disclaimers
       - Example endpoint: /api/chat with streaming response
*/