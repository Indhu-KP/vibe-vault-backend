'use client';

import { useState, useEffect, useCallback } from 'react';

const emotionMap = {
  love: {
    keywords: ['love', 'heart', 'romantic', 'crush', '❤️', '🫶'],
    emojis: ['❤️', '🫶'],
    class: 'mood-love',
  },
  excited: {
    keywords: ['excited', 'win', 'yeah', 'hype', 'awesome', '🎉', '🥳'],
    emojis: ['🎉', '🥳'],
    class: 'mood-excited',
  },
  happy: {
    keywords: ['happy', 'great', 'good', 'joyful', 'smiling', '✨', '🙂'],
    emojis: ['✨', '🙂'],
    class: 'mood-positive',
  },
  sad: {
    keywords: ['sad', 'depressed', 'upset', 'unhappy', 'cry', '💧', '🥺'],
    emojis: ['💧', '🥺'],
    class: 'mood-negative',
  },
  tired: {
    keywords: ['tired', 'exhausted', 'sleepy', 'burnt out', '💤', '😮‍💨'],
    emojis: ['💤', '😮‍💨'],
    class: 'mood-tired',
  },
  angry: {
    keywords: ['angry', 'mad', 'hate', 'furious', 'annoyed', '💢', '😡'],
    emojis: ['💢', '😡'],
    class: 'mood-negative',
  },
};

function detectEmotion(text) {
  const words = text.toLowerCase();
  for (const data of Object.values(emotionMap)) {
    if (data.keywords.some((word) => words.includes(word.toLowerCase()))) {
      return data;
    }
  }
  return null;
}

function pickMoodEmoji(emotion) {
  if (!emotion || !emotion.emojis || !emotion.emojis.length) {
    return '✨';
  }
  const idx = Math.floor(Math.random() * emotion.emojis.length);
  return emotion.emojis[idx];
}

function analyzeSentiment(text) {
  const words = text.toLowerCase();
  const scores = {
    positive: ['happy', 'great', 'good', 'joyful', 'smiling', 'love', 'awesome', 'win', 'excited'],
    negative: ['sad', 'depressed', 'upset', 'unhappy', 'cry', 'angry', 'mad', 'hate', 'furious', 'annoyed', 'tired', 'burnt out'],
  };

  let positiveHits = 0;
  let negativeHits = 0;

  scores.positive.forEach((word) => {
    if (words.includes(word)) positiveHits += 1;
  });

  scores.negative.forEach((word) => {
    if (words.includes(word)) negativeHits += 1;
  });

  if (positiveHits === 0 && negativeHits === 0) return 0.5;
  return positiveHits / (positiveHits + negativeHits);
}

const LOCAL_KEY = 'vibe-vault-entries';
const SESSION_TOKEN_KEY = 'vibe-vault-token';
const SESSION_USER_KEY = 'vibe-vault-user';
const SHADOW_KEY_PREFIX = 'vibe-vault-shadow';

export default function Home() {
  const [editor, setEditor] = useState('');
  const [title, setTitle] = useState('');
  const [userId, setUserId] = useState('');
  const [secretTitle, setSecretTitle] = useState('');
  const [entries, setEntries] = useState([]);
  const [currentMood, setCurrentMood] = useState(null);
  const [status, setStatus] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';
  const API_URL = `${API_BASE}/api/entries`;
  const REGISTER_URL = `${API_BASE}/api/auth/register`;
  const LOGIN_URL = `${API_BASE}/api/auth/login`;
  const LOGOUT_URL = `${API_BASE}/api/auth/logout`;

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    const user = localStorage.getItem(SESSION_USER_KEY);
    if (token && user) {
      setIsLoggedIn(true);
      loadEntries(token);
    } else {
      loadLocalEntries();
    }
  }, []);

  const loadLocalEntries = () => {
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      setEntries(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Failed to load local entries:', e);
      setEntries([]);
    }
  };

  const loadEntries = useCallback(
    async (token) => {
      try {
        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setEntries(data);
        } else {
          console.warn('Failed to load entries:', response.statusText);
          loadLocalEntries();
        }
      } catch (error) {
        console.error('Failed to connect to backend:', error);
        loadLocalEntries();
      }
    },
    [API_URL]
  );

  const saveEntry = async () => {
    if (!title || !editor) {
      setStatus('Please fill in title and content.');
      return;
    }

    const emotion = detectEmotion(editor);
    const sentiment = analyzeSentiment(editor);

    const newEntry = {
      id: Date.now(),
      title,
      content: editor,
      sentiment_score: sentiment,
      created_at: new Date().toISOString(),
      mood_emoji: pickMoodEmoji(emotion),
    };

    const token = localStorage.getItem(SESSION_TOKEN_KEY);

    if (token) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content: editor,
            sentimentScore: sentiment,
          }),
        });

        if (response.ok) {
          setStatus('✅ Entry saved to database!');
          setEditor('');
          setTitle('');
          loadEntries(token);
        } else {
          throw new Error('Failed to save entry');
        }
      } catch (error) {
        console.warn('Failed to save to backend, saving locally:', error);
        setEntries([newEntry, ...entries]);
        localStorage.setItem(LOCAL_KEY, JSON.stringify([newEntry, ...entries]));
        setStatus('✅ Entry saved locally.');
        setEditor('');
        setTitle('');
      }
    } else {
      setEntries([newEntry, ...entries]);
      localStorage.setItem(LOCAL_KEY, JSON.stringify([newEntry, ...entries]));
      setStatus('✅ Entry saved locally.');
      setEditor('');
      setTitle('');
    }

    setCurrentMood(emotion);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleRegister = async () => {
    if (!userId || !secretTitle) {
      setStatus('Please fill in User ID and Secret Title');
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: secretTitle }),
      });

      if (response.ok) {
        setStatus('✅ Registered! Please log in.');
      } else {
        const error = await response.json();
        setStatus(`❌ ${error.error}`);
      }
    } catch (error) {
      setStatus(`❌ Registration failed: ${error.message}`);
    } finally {
      setAuthBusy(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleLogin = async () => {
    if (!userId || !secretTitle) {
      setStatus('Please fill in User ID and Secret Title');
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: secretTitle }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(SESSION_TOKEN_KEY, data.token);
        localStorage.setItem(SESSION_USER_KEY, data.userId);
        setIsLoggedIn(true);
        setStatus('✅ Logged in!');
        loadEntries(data.token);
      } else {
        const error = await response.json();
        setStatus(`❌ ${error.error}`);
      }
    } catch (error) {
      setStatus(`❌ Login failed: ${error.message}`);
    } finally {
      setAuthBusy(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);

    try {
      await fetch(LOGOUT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }

    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    setIsLoggedIn(false);
    setStatus('✅ Logged out.');
    setUserId('');
    setSecretTitle('');
    loadLocalEntries();
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="bg-glow bg-glow-a"></div>,
    <div className="bg-glow bg-glow-b"></div>,
    <main className="app-shell">
      <section className="panel panel-compose" aria-label="Write a diary entry">
        <h1>Vibe Vault</h1>
        <p className="tagline">Track your mood, save your thoughts, and see your story build up.</p>

        <div className="auth-block" aria-label="Account access">
          <label htmlFor="userId">User ID</label>
          <input
            id="userId"
            placeholder="Choose your user ID"
            maxLength="80"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isLoggedIn}
          />

          <label htmlFor="secretTitle">Secret title</label>
          <input
            id="secretTitle"
            type="password"
            placeholder="Use a private phrase"
            maxLength="200"
            value={secretTitle}
            onChange={(e) => setSecretTitle(e.target.value)}
            disabled={isLoggedIn}
          />

          <div className="actions-row auth-actions">
            <button
              id="registerBtn"
              className="ghost-btn"
              type="button"
              onClick={handleRegister}
              disabled={authBusy || isLoggedIn}
            >
              Register
            </button>
            <button
              id="loginBtn"
              type="button"
              onClick={handleLogin}
              disabled={authBusy || isLoggedIn}
            >
              Login
            </button>
            <button
              id="logoutBtn"
              className="ghost-btn"
              type="button"
              onClick={handleLogout}
              disabled={!isLoggedIn}
            >
              Logout
            </button>
          </div>
        </div>

        <label htmlFor="title">Entry title</label>
        <input
          id="title"
          placeholder="Today felt like..."
          maxLength="80"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label htmlFor="editor">Your note</label>
        <textarea
          id="editor"
          placeholder="Write your thoughts..."
          value={editor}
          onChange={(e) => setEditor(e.target.value)}
        ></textarea>

        <div className="actions-row">
          <button id="saveBtn" type="button" onClick={saveEntry}>
            Save Entry
          </button>
          <p id="status" className="status" aria-live="polite">
            {status}
          </p>
        </div>
      </section>

      <section className="panel panel-feed" aria-label="Saved entries">
        <div className="feed-header"></div>
        <div id="feed">
          {entries.length === 0 ? (
            <p className="no-entries">No entries yet. Start writing!</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="entry-card">
                <h3>{entry.title}</h3>
                <p className="entry-date">{new Date(entry.created_at).toLocaleDateString()}</p>
                <p className="entry-content">{entry.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
