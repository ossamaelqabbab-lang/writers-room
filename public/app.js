// ---------- إعدادات ثابتة ----------
// الأدوار الثلاثة تستخدم الآن مفتاح Gemini المجاني نفسه

const AGENTS = {
  writer: {
    name: 'الكاتب',
    endpoint: '/api/gemini',
    keyId: 'geminiKey',
    modelId: 'geminiModel',
    system:
      'أنت روائي محترف يكتب بالعربية الفصحى بأسلوب أدبي راقٍ. أنت عضو في "غرفة كتّاب" جماعية: يشاركك محرر ناقد ومفكّر استراتيجي. مهمتك كتابة أو تطوير نص الرواية نفسه (فصول، مشاهد، حوار، وصف) بناءً على النقاش الدائر. لا تكرر ما قيل، بل اكتب نصًا أدبيًا فعليًا يدفع الرواية للأمام. اجعل ردك 1000-1500 كلمة.',
  },
  editor: {
    name: 'المحرر الناقد',
    endpoint: '/api/gemini',
    keyId: 'geminiKey',
    modelId: 'geminiModel',
    system:
      'أنت محرر أدبي وناقد صارم لكنه بنّاء، تشارك في "غرفة كتّاب" جماعية مع كاتب ومفكّر استراتيجي. مهمتك قراءة آخر ما كتبه الكاتب ونقده بدقة: نقاط القوة، الثغرات في الإيقاع أو الشخصيات أو الحبكة، واقتراحات تحسين محددة وقابلة للتنفيذ. لا تكتب نصًا روائيًا بنفسك، بل قدّم نقدًا واضحًا. اجعل ردك 900-1300 كلمة.',
  },
  thinker: {
    name: 'المفكّر',
    endpoint: '/api/gemini',
    keyId: 'geminiKey',
    modelId: 'geminiModel',
    system:
      'أنت مفكّر استراتيجي ومطوّر أفكار في "غرفة كتّاب" جماعية مع كاتب ومحرر ناقد. مهمتك اقتراح منعطفات درامية، أسرار، دوافع خفية للشخصيات، ورموز أو دلالات أعمق تُغني الرواية، بناءً على النقاش الدائر وملاحظات المحرر. كن جريئًا وغير متوقع. لا تكتب نصًا روائيًا كاملاً، بل أفكارًا ومقترحات محددة. اجعل ردك 950-1000 كلمة.',
  },
};

const ORDER = ['thinker', 'writer', 'editor'];

let transcript = [];
let currentRound = 0;
let storyIdea = '';
let isRunning = false;

// ---------- عناصر DOM ----------

const transcriptEl = document.getElementById('transcript');
const ideaInput = document.getElementById('ideaInput');
const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const roundsInput = document.getElementById('roundsInput');

const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');

// ---------- إعدادات المفاتيح ----------

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('writersRoomSettings') || '{}');
  Object.entries(saved).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function saveSettingsToStorage() {
  const ids = ['geminiKey', 'geminiModel'];
  const data = {};
  ids.forEach((id) => { data[id] = document.getElementById(id).value; });
  localStorage.setItem('writersRoomSettings', JSON.stringify(data));
}

function getAgentCredentials(agentKey) {
  const agent = AGENTS[agentKey];
  return {
    apiKey: document.getElementById(agent.keyId).value.trim(),
    model: document.getElementById(agent.modelId).value.trim(),
  };
}

settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});
saveSettings.addEventListener('click', () => {
  saveSettingsToStorage();
  settingsModal.classList.add('hidden');
});

// ---------- بناء الطلب لكل وكيل ----------

function buildPrompt(agentKey) {
  const header = `فكرة الرواية الأساسية:\n"${storyIdea}"\n\n`;

  if (transcript.length === 0) {
    return header + 'ابدأ النقاش الآن بأول مساهمة تخص دورك.';
  }

  const history = transcript
    .filter((m) => !m.error)
    .map((m) => `${m.name} (الجولة ${m.round}):\n${m.text}`)
    .join('\n\n---\n\n');

  return `${header}سجل النقاش حتى الآن:\n\n${history}\n\n---\n\nبناءً على ما سبق، اكتب مساهمتك التالية بصفتك: ${AGENTS[agentKey].name}.`;
}

// ---------- استدعاء API ----------

async function callAgent(agentKey) {
  const agent = AGENTS[agentKey];
  const { apiKey, model } = getAgentCredentials(agentKey);

  if (!apiKey) {
    return { error: `لا يوجد مفتاح Gemini. افتح إعداد النماذج وأضف المفتاح.` };
  }

  setStatus(agentKey, 'يكتب الآن…', true);

  try {
    const res = await fetch(agent.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model,
        system: agent.system,
        prompt: buildPrompt(agentKey),
      }),
    });

    const data = await res.json();
    setStatus(agentKey, 'جاهز', false);

    if (!res.ok) {
      return { error: data.error || 'خطأ غير معروف' };
    }
    return { text: data.text || '(رد فارغ)' };
  } catch (err) {
    setStatus(agentKey, 'خطأ اتصال', false);
    return { error: 'تعذر الوصول إلى الخادم: ' + err.message };
  }
}

function setStatus(agentKey, label, thinking) {
  const el = document.querySelector(`[data-status="${agentKey}"]`);
  if (!el) return;
  el.textContent = label;
  el.classList.toggle('thinking', !!thinking);
}

// ---------- عرض الرسائل ----------

function renderMessage(agentKey, text, round, isError) {
  removeEmptyState();

  const wrap = document.createElement('div');
  wrap.className = `message ${agentKey}${isError ? ' error' : ''}`;

  const head = document.createElement('div');
  head.className = 'message-head';

  const name = document.createElement('span');
  name.className = 'message-name';
  name.textContent = AGENTS[agentKey].name;

  const roundLabel = document.createElement('span');
  roundLabel.className = 'message-round';
  roundLabel.textContent = `الجولة ${round}`;

  head.appendChild(name);
  head.appendChild(roundLabel);

  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = text;

  wrap.appendChild(head);
  wrap.appendChild(body);
  transcriptEl.appendChild(wrap);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function removeEmptyState() {
  const empty = transcriptEl.querySelector('.empty-state');
  if (empty) empty.remove();
}

// ---------- تشغيل الجولات ----------

async function runRounds(numRounds) {
  isRunning = true;
  setControlsEnabled(false);

  for (let i = 0; i < numRounds; i++) {
    currentRound += 1;

    for (const agentKey of ORDER) {
      const result = await callAgent(agentKey);

      if (result.error) {
        transcript.push({ agentKey, name: AGENTS[agentKey].name, text: result.error, round: currentRound, error: true });
        renderMessage(agentKey, result.error, currentRound, true);
      } else {
        transcript.push({ agentKey, name: AGENTS[agentKey].name, text: result.text, round: currentRound, error: false });
        renderMessage(agentKey, result.text, currentRound, false);
      }
    }
  }

  isRunning = false;
  setControlsEnabled(true);
  continueBtn.disabled = false;
  exportBtn.disabled = transcript.length === 0;
}

function setControlsEnabled(enabled) {
  startBtn.disabled = !enabled;
  continueBtn.disabled = !enabled || transcript.length === 0;
  resetBtn.disabled = !enabled;
}

// ---------- أزرار التحكم ----------

startBtn.addEventListener('click', () => {
  const idea = ideaInput.value.trim();
  if (!idea) {
    ideaInput.focus();
    return;
  }
  if (isRunning) return;

  storyIdea = idea;
  transcript = [];
  currentRound = 0;
  transcriptEl.innerHTML = '';

  const numRounds = clampRounds();
  runRounds(numRounds);
});

continueBtn.addEventListener('click', () => {
  if (isRunning || !storyIdea) return;
  const numRounds = clampRounds();
  runRounds(numRounds);
});

resetBtn.addEventListener('click', () => {
  if (isRunning) return;
  transcript = [];
  currentRound = 0;
  storyIdea = '';
  ideaInput.value = '';
  transcriptEl.innerHTML = '<div class="empty-state"><p>اكتب فكرة الرواية بالأسفل، واضبط مفتاح Gemini، ثم ابدأ الحوار.</p></div>';
  continueBtn.disabled = true;
  exportBtn.disabled = true;
});

exportBtn.addEventListener('click', () => {
  const lines = [`فكرة الرواية: ${storyIdea}`, ''];
  transcript.forEach((m) => {
    if (m.error) return;
    lines.push(`## ${m.name} — الجولة ${m.round}`, '', m.text, '');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'نقاش-غرفة-الكتاب.txt';
  a.click();
  URL.revokeObjectURL(url);
});

function clampRounds() {
  let n = parseInt(roundsInput.value, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 6) n = 6;
  roundsInput.value = n;
  return n;
}

// ---------- تهيئة ----------

loadSettings();
