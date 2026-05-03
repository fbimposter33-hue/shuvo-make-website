/* ═══════════════════════════════════════════════════
   SHUVO-SA · Frontend Logic
   ═══════════════════════════════════════════════════ */

// ─── CONFIG ─────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:3000'; // Change to your backend URL
const MAX_CHARS = 500;
const STORAGE_KEY_MESSAGES = 'shuvo_sa_messages';
const STORAGE_KEY_USER_ID   = 'shuvo_sa_user_id';

// ─── STATE ───────────────────────────────────────────────────────
let isLoading = false;
let messageHistory = [];

// ─── DOM REFS ────────────────────────────────────────────────────
const messagesEl    = document.getElementById('messages');
const messagesWrap  = document.getElementById('messagesWrap');
const inputEl       = document.getElementById('messageInput');
const sendBtn       = document.getElementById('sendBtn');
const charCountEl   = document.getElementById('charCount');
const inputWrapper  = document.getElementById('inputWrapper');
const toastEl       = document.getElementById('toast');
const welcomeScreen = document.getElementById('welcomeScreen');
const recentList    = document.getElementById('recentList');
const sidebar       = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const clearBtns     = [document.getElementById('clearBtn'), document.getElementById('clearBtn2')];

// ─── USER ID ─────────────────────────────────────────────────────
function getUserId() {
  let id = localStorage.getItem(STORAGE_KEY_USER_ID);
  if (!id) {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(STORAGE_KEY_USER_ID, id);
  }
  return id;
}
const USER_ID = getUserId();

// ─── UTILS ───────────────────────────────────────────────────────
function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Minimal markdown → HTML renderer
function renderMarkdown(text) {
  let html = escapeHtml(text);
  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Unordered lists
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
  // Line breaks → paragraphs
  const lines = html.split('\n');
  const result = [];
  let inPre = false;
  for (const line of lines) {
    if (line.startsWith('<pre>')) inPre = true;
    if (line.endsWith('</pre>')) inPre = false;
    if (!inPre && line.trim() && !line.match(/^<(h[123]|ul|ol|li|pre|blockquote)/)) {
      result.push(`<p>${line}</p>`);
    } else {
      result.push(line);
    }
  }
  return result.join('');
}

function showToast(msg, duration = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

function scrollToBottom(smooth = true) {
  messagesWrap.scrollTo({ top: messagesWrap.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

// ─── STORAGE ─────────────────────────────────────────────────────
function saveMessages() {
  // Keep last 100 messages to avoid storage bloat
  const toSave = messageHistory.slice(-100);
  localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(toSave));
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── RENDER MESSAGE ───────────────────────────────────────────────
function renderMessage({ role, content, time, isError }) {
  const isUser = role === 'user';

  const group = document.createElement('div');
  group.className = 'msg-group';

  const row = document.createElement('div');
  row.className = `msg-row ${isUser ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${isUser ? 'user' : 'bot'}`;
  avatar.textContent = isUser ? 'U' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = `bubble ${isUser ? 'user' : 'bot'}${isError ? ' error' : ''}`;

  if (isUser) {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = isError ? escapeHtml(content) : renderMarkdown(content);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  group.appendChild(row);

  // Meta row (time + copy)
  const meta = document.createElement('div');
  meta.className = 'bubble-meta';

  if (!isUser && !isError) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '⎘ Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => showToast('Copied!'));
    });
    meta.appendChild(copyBtn);
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'bubble-time';
  timeEl.textContent = time || getTime();
  meta.appendChild(timeEl);

  group.appendChild(meta);
  return group;
}

// ─── TYPING INDICATOR ────────────────────────────────────────────
function showTyping() {
  const row = document.createElement('div');
  row.className = 'typing-row';
  row.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar bot';
  avatar.textContent = '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  [1,2,3].forEach(i => {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    bubble.appendChild(dot);
  });

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────
async function sendMessage(text) {
  const content = (text || inputEl.value).trim();
  if (!content || isLoading) return;
  if (content.length > MAX_CHARS) {
    showToast('Message too long (max 500 chars)');
    return;
  }

  // Hide welcome screen
  welcomeScreen?.remove();

  // Add to history and render
  const time = getTime();
  const userMsg = { role: 'user', content, time };
  messageHistory.push(userMsg);
  saveMessages();

  messagesEl.appendChild(renderMessage(userMsg));
  inputEl.value = '';
  autoResize();
  updateSendBtn();
  scrollToBottom();
  updateRecent();

  // Set loading state
  isLoading = true;
  inputEl.disabled = true;
  sendBtn.disabled = true;
  inputWrapper.classList.add('loading');
  showTyping();

  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, user_id: USER_ID }),
    });

    hideTyping();

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      throw new Error(data.error || `Server error (${res.status})`);
    }

    const botMsg = { role: 'bot', content: data.reply, time: getTime() };
    messageHistory.push(botMsg);
    saveMessages();
    messagesEl.appendChild(renderMessage(botMsg));

  } catch (err) {
    hideTyping();
    const errMsg = {
      role: 'bot',
      content: err.message || 'Something went wrong. Please try again.',
      time: getTime(),
      isError: true,
    };
    messagesEl.appendChild(renderMessage(errMsg));
  } finally {
    isLoading = false;
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputWrapper.classList.remove('loading');
    inputEl.focus();
    scrollToBottom();
  }
}

// ─── INPUT HELPERS ────────────────────────────────────────────────
function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
}

function updateSendBtn() {
  const val = inputEl.value.trim();
  sendBtn.disabled = !val || isLoading;

  const len = inputEl.value.length;
  charCountEl.textContent = `${len}/${MAX_CHARS}`;
  charCountEl.className = `char-count${len > 420 ? ' warn' : ''}`;
}

// ─── CLEAR CHAT ───────────────────────────────────────────────────
function clearChat() {
  messageHistory = [];
  saveMessages();

  messagesEl.innerHTML = '';

  // Re-add welcome screen
  const ws = document.createElement('div');
  ws.id = 'welcomeScreen';
  ws.className = 'welcome-screen';
  ws.innerHTML = `
    <div class="welcome-icon">⚡</div>
    <h1 class="welcome-title">SHUVO-SA</h1>
    <p class="welcome-sub">Your intelligent AI companion. Ask me anything.</p>
    <div class="welcome-chips">
      <button class="chip" data-msg="What can you do?">What can you do?</button>
      <button class="chip" data-msg="Write me a poem about the cosmos">Write a poem ✨</button>
      <button class="chip" data-msg="Explain quantum computing simply">Explain quantum computing</button>
      <button class="chip" data-msg="Help me write a professional email">Draft an email 📧</button>
    </div>`;
  messagesEl.appendChild(ws);
  bindChips();
  updateRecent();
  showToast('Chat cleared');
}

// ─── RECENT LIST ─────────────────────────────────────────────────
function updateRecent() {
  const userMsgs = messageHistory.filter(m => m.role === 'user').slice(-8).reverse();
  recentList.innerHTML = '';
  if (userMsgs.length === 0) {
    recentList.innerHTML = '<div class="recent-item" style="font-style:italic;opacity:0.4">No history yet</div>';
    return;
  }
  userMsgs.forEach(m => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.textContent = m.content.slice(0, 40) + (m.content.length > 40 ? '…' : '');
    recentList.appendChild(item);
  });
}

// ─── SIDEBAR TOGGLE ───────────────────────────────────────────────
let sidebarOpen = true;
sidebarToggle.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  if (window.innerWidth <= 680) {
    sidebar.classList.toggle('open', sidebarOpen);
  } else {
    sidebar.classList.toggle('hidden', !sidebarOpen);
  }
});

// ─── CHIP CLICKS ─────────────────────────────────────────────────
function bindChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.msg));
  });
}

// ─── CLEAR BUTTONS ───────────────────────────────────────────────
clearBtns.forEach(btn => btn?.addEventListener('click', clearChat));

// ─── INPUT EVENTS ────────────────────────────────────────────────
inputEl.addEventListener('input', () => { autoResize(); updateSendBtn(); });
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', () => sendMessage());

// ─── RESTORE HISTORY ─────────────────────────────────────────────
function restoreHistory() {
  const saved = loadMessages();
  if (!saved.length) return;

  messageHistory = saved;
  welcomeScreen?.remove();

  saved.forEach(msg => {
    messagesEl.appendChild(renderMessage(msg));
  });
  scrollToBottom(false);
  updateRecent();
}

// ─── INIT ─────────────────────────────────────────────────────────
bindChips();
restoreHistory();
updateSendBtn();
inputEl.focus();

// Mobile: close sidebar on outside click
document.addEventListener('click', e => {
  if (window.innerWidth <= 680 && sidebarOpen) {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebarOpen = false;
      sidebar.classList.remove('open');
    }
  }
});
