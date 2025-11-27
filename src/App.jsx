import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  Users, BarChart2, MessageSquare, LogOut, Save, Clock, CheckCircle, AlertCircle, 
  Phone, Search, ChevronRight, Briefcase, ArrowLeft, Menu, X, Plus, Trash2, 
  UserPlus, CheckSquare, Edit2, Square, FileText, Clipboard, Check, Trophy, Medal, 
  Zap, Star, Settings, Moon, Sun, User, Sparkles, Upload, Download, FileSpreadsheet,
  TrendingUp, Activity, PhoneForwarded, PauseCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, signInWithCustomToken, updateProfile 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  deleteDoc, doc, setDoc, updateDoc, getDoc, writeBatch 
} from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// --- 🎨 BRAND CONFIGURATION ---
const COMPANY_THEME = {
  primary: '#0089CF', // Cyan-Blue from Logo
  accent:  '#8CC63F', // Lime Green from Logo
  logoText: 'Service Desk'
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("App Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 inline-block text-left">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><AlertCircle /> Critical Error</h2>
            <p className="text-sm mb-2">The application encountered a critical error.</p>
            <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-w-sm">{this.state.error?.message}</pre>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-white rounded-lg text-sm font-bold" style={{ backgroundColor: COMPANY_THEME.primary }}>Reload App</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- FIREBASE CONFIG (Local Vite Version) ---
let app, auth, db;
try {
  const firebaseConfig = {
    apiKey: "AIzaSyCWA2cHOqph0lJRjgYIQeRKnIJGsB_WW8Y",
  authDomain: "service-desk-app-a2f56.firebaseapp.com",
  projectId: "service-desk-app-a2f56",
  storageBucket: "service-desk-app-a2f56.firebasestorage.app",
  messagingSenderId: "716584978528",
  appId: "1:716584978528:web:36a810a12bcb9fd283db05"
  };
  
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) { console.error("Firebase Init Error:", e); }

const appId = 'default-app-id';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 

// --- GEMINI API ---
const callGemini = async (prompt) => {
  if (!apiKey) return "AI Key missing. Please add VITE_GEMINI_API_KEY to .env.local";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate response.";
  } catch (error) { return "Error connecting to AI Assistant."; }
};

// --- CSV PARSER HELPER ---
const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'; 
        i++;
      } else {
        insideQuotes = !insideQuotes; 
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }
  return rows;
};

// --- COMPONENTS ---
const StatCard = ({ title, value, subtext, icon: Icon, isDarkMode }) => (
  <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-colors duration-200`}>
    <div className="flex justify-between items-start mb-2">
      <div className="p-2 rounded-lg bg-opacity-10" style={{ backgroundColor: `${COMPANY_THEME.accent}20`, color: COMPANY_THEME.accent }}>
        <Icon size={20} />
      </div>
    </div>
    <div>
      <h3 className={`${isDarkMode ? 'text-white' : 'text-slate-800'} text-2xl font-bold`}>{value}</h3>
      <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-sm font-medium`}>{title}</p>
      {subtext && <p className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-xs mt-1`}>{subtext}</p>}
    </div>
  </div>
);

const LeaderboardRow = ({ rank, name, value, subLabel, type, isDarkMode }) => {
  let medalStyle = { backgroundColor: isDarkMode ? '#475569' : '#e2e8f0', color: isDarkMode ? '#94a3b8' : '#64748b' };
  let Icon = Medal;
  if (rank === 1) { medalStyle = { backgroundColor: '#fef9c3', color: '#ca8a04' }; Icon = Trophy; }
  else if (rank === 2) { medalStyle = { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', color: isDarkMode ? '#cbd5e1' : '#475569' }; }
  else if (rank === 3) { medalStyle = { backgroundColor: '#ffedd5', color: '#c2410c' }; }

  return (
    <div className={`flex items-center justify-between p-3 border-b ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-50 hover:bg-slate-50'} last:border-0 transition-colors`}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm" style={medalStyle}>
          {rank === 1 ? <Icon size={14} /> : rank}
        </div>
        <span className={`font-medium text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{name}</span>
      </div>
      <div className="text-right">
        <span className="font-bold" style={{ color: type === 'csat' ? '#16a34a' : COMPANY_THEME.accent }}>{value}</span>
        <span className={`text-xs block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{subLabel}</span>
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full p-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: COMPANY_THEME.accent }}></div>
  </div>
);

// --- MAIN APP LOGIC ---
function ServiceDeskLogic() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userRole, setUserRole] = useState('Team Lead');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [agents, setAgents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allStats, setAllStats] = useState({});

  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('L1 Analyst');
  const [editingStats, setEditingStats] = useState({ 
    incidentsResolved: 0, csat: 0, aht: 0, slaBreach: 0, 
    callsAnswered: 0, avgHold: 0, transfers: 0 
  });

  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const initAuth = async () => { setLoading(false); };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.darkMode !== undefined) setIsDarkMode(data.darkMode);
          if (data.role) setUserRole(data.role);
        }
      } catch (err) { console.warn("Settings fetch error", err); }
    };
    fetchSettings();
    const unsubAgents = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'agents'), orderBy('createdAt', 'asc')), (s) => setAgents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubStats = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'agent_stats'), (s) => { const map = {}; s.docs.forEach(d => map[d.id] = d.data()); setAllStats(map); });
    const unsubTasks = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc')), (s) => setAllTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubAgents(); unsubStats(); unsubTasks(); };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedAgent || !db) return;
    const unsubNotes = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'one_to_one_notes'), orderBy('createdAt', 'desc')), (s) => setNotes(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => n.agentId === selectedAgent.id)));
    return () => unsubNotes();
  }, [user, selectedAgent]);

  // --- MULTI-FORMAT CSV IMPORT ---
  const handleFileUpload = async (event) => {
    setCsvError('');
    setCsvSuccess('');
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      try {
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error("CSV is empty or missing headers.");

        const headers = rows[0].map(h => h.toLowerCase().replace(/['"]+/g, '').trim());
        
        const isGenesys = headers.includes('agent name');
        const isServiceNow = headers.includes('assigned to');

        if (!isGenesys && !isServiceNow) throw new Error("Unknown CSV format. Expected 'Agent Name' (Genesys) or 'Assigned to' (ServiceNow).");

        const batch = writeBatch(db);
        let updateCount = 0;
        const agentStatsMap = {};

        if (isServiceNow) {
          const assignedToIndex = headers.findIndex(h => h === 'assigned to');
          const slaIndex = headers.findIndex(h => h === 'out of sla');
          
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length < 2) continue;
            const rawName = cols[assignedToIndex];
            const name = rawName ? rawName.replace(/^"|"$/g, '').trim() : '';
            if (!name) continue;

            if (!agentStatsMap[name]) agentStatsMap[name] = { resolved: 0, breached: 0 };
            agentStatsMap[name].resolved += 1;
            if (slaIndex > -1) {
               const slaValue = cols[slaIndex] ? cols[slaIndex].toLowerCase().replace(/['"]+/g, '').trim() : '';
               if (slaValue === 'true') agentStatsMap[name].breached += 1;
            }
          }
        } else if (isGenesys) {
          const nameIndex = headers.findIndex(h => h === 'agent name');
          const answeredIndex = headers.findIndex(h => h === 'answered');
          const ahtIndex = headers.findIndex(h => h === 'avg handle');
          const holdIndex = headers.findIndex(h => h === 'avg hold'); // New
          const transferIndex = headers.findIndex(h => h === 'transferred'); // New

          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length < 2) continue;
            
            const rawName = cols[nameIndex];
            const name = rawName ? rawName.replace(/^"|"$/g, '').trim() : '';
            if (!name) continue;

            const answered = parseInt(cols[answeredIndex]) || 0;
            const rawAht = parseFloat(cols[ahtIndex]) || 0;
            const ahtSeconds = rawAht > 10000 ? Math.round(rawAht / 1000) : Math.round(rawAht);
            
            const rawHold = parseFloat(cols[holdIndex]) || 0; // New
            const holdSeconds = rawHold > 10000 ? Math.round(rawHold / 1000) : Math.round(rawHold); // Normalize ms to s if needed
            
            const transfers = parseInt(cols[transferIndex]) || 0; // New

            if (!agentStatsMap[name]) agentStatsMap[name] = {};
            agentStatsMap[name].answered = answered;
            agentStatsMap[name].aht = ahtSeconds;
            agentStatsMap[name].hold = holdSeconds;
            agentStatsMap[name].transfers = transfers;
          }
        }

        agents.forEach(agent => {
          const stats = agentStatsMap[agent.name] || agentStatsMap[agent.name.replace(/^"/, '').replace(/"$/, '')]; 
          
          if (stats) {
            const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'agent_stats', agent.id);
            
            const updateData = { lastUpdated: serverTimestamp() };
            if (stats.resolved !== undefined) updateData.incidentsResolved = stats.resolved;
            if (stats.breached !== undefined) updateData.slaBreach = stats.breached;
            if (stats.answered !== undefined) updateData.callsAnswered = stats.answered; 
            if (stats.aht !== undefined) updateData.aht = stats.aht;
            if (stats.hold !== undefined) updateData.avgHold = stats.hold; // New field
            if (stats.transfers !== undefined) updateData.transfers = stats.transfers; // New field

            batch.set(statsRef, updateData, { merge: true });
            updateCount++;
          }
        });

        if (updateCount > 0) {
          await batch.commit();
          setCsvSuccess(`Success! Updated stats for ${updateCount} agents from ${isGenesys ? 'Genesys' : 'ServiceNow'}.`);
        } else {
          setCsvError("No matching agents found. Ensure agent names in App match the CSV.");
        }

      } catch (err) {
        console.error(err);
        setCsvError("Error parsing CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // --- DASHBOARD STATS CALCULATION ---
  const dashboardStats = useMemo(() => {
    const vals = Object.values(allStats);
    const count = vals.length;
    
    if (count === 0) return { sla: '0%', totalIncidents: 0, totalBreaches: 0, totalCalls: 0, aht: '0s', rawAht: 0, rawCsat: 0 };

    const totalBreaches = vals.reduce((a, c) => a + (parseInt(c.slaBreach) || 0), 0);
    const totalIncidents = vals.reduce((a, c) => a + (parseInt(c.incidentsResolved) || 0), 0);
    const totalCalls = vals.reduce((a, c) => a + (parseInt(c.callsAnswered) || 0), 0); 
    
    const agentsWithAht = vals.filter(c => (parseInt(c.aht) || 0) > 0);
    const totalAhtSum = agentsWithAht.reduce((a, c) => a + (parseInt(c.aht) || 0), 0);
    const avgAht = agentsWithAht.length > 0 ? Math.round(totalAhtSum / agentsWithAht.length) : 0;

    const totalCsat = vals.reduce((a, c) => a + (parseFloat(c.csat) || 0), 0);
    const avgCsat = (totalCsat / count).toFixed(1);

    const slaPerf = totalIncidents > 0 ? ((1 - (totalBreaches / totalIncidents)) * 100).toFixed(1) + '%' : '100%';

    return { sla: slaPerf, totalIncidents, totalBreaches, totalCalls, aht: (avgAht || 0) + 's', rawAht: avgAht || 0, rawCsat: avgCsat || "0.0" };
  }, [allStats]);

  const leaderboardData = useMemo(() => {
    const ranked = agents.map(a => { const s = allStats[a.id] || { csat: 0, aht: 9999 }; return { ...a, csat: parseFloat(s.csat) || 0, aht: parseInt(s.aht) || 0 }; });
    return { topCsat: [...ranked].sort((a, b) => b.csat - a.csat).filter(a => a.csat > 0).slice(0, 3), topAht: [...ranked].filter(a => a.aht > 0).sort((a, b) => a.aht - b.aht).slice(0, 3) };
  }, [agents, allStats]);

  const generateAiFeedback = async () => {
    if (!selectedAgent) return; setIsGeneratingAi(true);
    const s = allStats[selectedAgent.id] || { incidentsResolved: 0, csat: 0, aht: 0 };
    const feedback = await callGemini(`Analyze agent ${selectedAgent.name} (${selectedAgent.role}). Stats: CSAT ${s.csat}, AHT ${s.aht}s, Incidents ${s.incidentsResolved}. Write a concise coaching plan.`);
    setNewNote(prev => prev ? prev + '\n\n' + feedback : feedback); setIsGeneratingAi(false);
  };

  const generateWeeklyReport = async () => {
    setIsReportGenerating(true);
    const aiReport = await callGemini(`Write a Weekly Service Desk Summary. SLA: ${dashboardStats.sla}. AHT: ${dashboardStats.aht}. Team Size: ${agents.length}. Top Performers: ${leaderboardData.topCsat[0]?.name}.`);
    setReportText(aiReport); setIsReportGenerating(false); setIsReportModalOpen(true);
  };

  const copyReportToClipboard = () => { navigator.clipboard.writeText(reportText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const handleLogin = async (e) => { e.preventDefault(); try { isRegistering ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password); } catch (err) { setAuthError(err.message); } };
  const handleUpdateProfile = async (name, role) => { if (name !== user.displayName) await updateProfile(user, { displayName: name }); await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { role, darkMode: isDarkMode }, { merge: true }); setUserRole(role); alert("Settings saved!"); };
  const toggleDarkMode = async () => { setIsDarkMode(!isDarkMode); if(user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { darkMode: !isDarkMode }, { merge: true }); };
  const handleAddAgent = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'agents'), { name: newAgentName, role: newAgentRole, avatar: newAgentName.slice(0,2).toUpperCase(), createdAt: serverTimestamp() }); setIsAddAgentModalOpen(false); setNewAgentName(''); };
  const handleDeleteAgent = async (id, e) => { e.stopPropagation(); if(window.confirm("Remove agent?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'agents', id)); };
  const handleSaveNote = async () => { if(newNote.trim()) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'one_to_one_notes'), { text: newNote, agentId: selectedAgent.id, createdAt: serverTimestamp() }); setNewNote(''); } };
  const handleAddTask = async () => { if(newTask.trim()) { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { text: newTask, completed: false, agentId: selectedAgent.id, createdAt: serverTimestamp() }); setNewTask(''); } };
  const toggleTask = async (task) => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { completed: !task.completed });
  const deleteTask = async (id) => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', id));
  const handleSaveStats = async (e) => { e.preventDefault(); await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'agent_stats', selectedAgent.id), editingStats); setIsStatsModalOpen(false); };

  if (loading) return <LoadingSpinner />;
  if (!user) return (
    <div className={`min-h-[100dvh] flex flex-col justify-center py-12 px-4 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex p-3 rounded-xl text-white mb-4" style={{ backgroundColor: COMPANY_THEME.primary }}><Users size={32} /></div>
        <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{COMPANY_THEME.logoText}</h2>
      </div>
      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md p-8 shadow rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} required />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button type="submit" className="w-full py-2 text-white rounded-md font-medium" style={{ backgroundColor: COMPANY_THEME.primary }}>{isRegistering ? 'Register' : 'Sign In'}</button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-sm" style={{ color: COMPANY_THEME.accent }}>{isRegistering ? 'Login instead' : 'Create account'}</button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-[100dvh] font-sans overflow-hidden ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-20 flex flex-col items-center py-6 gap-8 shadow-xl transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isDarkMode ? 'bg-slate-900 border-r border-slate-800' : ''}`} style={!isDarkMode ? { backgroundColor: COMPANY_THEME.primary } : {}}>
        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold shadow-lg" style={{ backgroundColor: isDarkMode ? COMPANY_THEME.primary : 'rgba(255,255,255,0.2)' }}>SD</div>
        <nav className="flex-1 flex flex-col gap-4 w-full">
          {['dashboard', 'onetoone', 'team', 'profile'].map(v => (
            <button key={v} onClick={() => { setView(v); setIsMobileMenuOpen(false); }} className={`p-3 mx-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${view === v ? 'text-white shadow-md' : 'text-white/60 hover:text-white'}`} style={view === v ? { backgroundColor: COMPANY_THEME.accent } : {}}>
              {v === 'dashboard' && <BarChart2 size={24} />}
              {v === 'onetoone' && <MessageSquare size={24} />}
              {v === 'team' && <Briefcase size={24} />}
              {v === 'profile' && <Settings size={24} />}
              <span className="text-[10px] font-medium capitalize">{v === 'onetoone' ? '1:1s' : v}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => { signOut(auth); setView('dashboard'); setSelectedAgent(null); }} className="p-3 rounded-xl text-white/50 hover:text-white"><LogOut size={20} /></button>
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden md:ml-20">
        <header className={`flex items-center justify-between px-6 h-16 border-b shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(true)}><Menu /></button>
            <h1 className="text-xl font-bold capitalize">{view === 'onetoone' ? '1:1 Management' : view}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block"><p className="text-sm font-bold">{userRole}</p><p className="text-xs opacity-70">{user.email}</p></div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold border border-white/20" style={{ backgroundColor: COMPANY_THEME.accent }}>TL</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h2 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Team Overview</h2><span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{agents.length} Active Agents</span></div>
                <button onClick={generateWeeklyReport} disabled={isReportGenerating} className="w-full md:w-auto px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-white transition-colors" style={{ backgroundColor: COMPANY_THEME.accent }}>{isReportGenerating ? <LoadingSpinner /> : <FileText size={18} />}{isReportGenerating ? 'Generating...' : 'Generate AI Report ✨'}</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard isDarkMode={isDarkMode} title="Total Incidents" value={dashboardStats.totalIncidents} icon={CheckCircle} />
                <StatCard isDarkMode={isDarkMode} title="Total Breaches" value={dashboardStats.totalBreaches} icon={AlertCircle} />
                <StatCard isDarkMode={isDarkMode} title="Team SLA %" value={dashboardStats.sla} icon={Trophy} />
                <StatCard isDarkMode={isDarkMode} title="Avg AHT" value={dashboardStats.aht} icon={Clock} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border shadow-sm overflow-hidden`}>
                  <div className={`p-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}><Star size={20} style={{ color: COMPANY_THEME.accent }} /><h3 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>CSAT Champions</h3></div>
                  <div>{leaderboardData.topCsat.map((agent, index) => <LeaderboardRow key={agent.id} rank={index + 1} name={agent.name} value={agent.csat} subLabel="Rating" type="csat" isDarkMode={isDarkMode} />)}</div>
                </div>
                <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border shadow-sm overflow-hidden`}>
                  <div className={`p-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}><Zap size={20} style={{ color: COMPANY_THEME.accent }} /><h3 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Efficiency Stars</h3></div>
                  <div>{leaderboardData.topAht.map((agent, index) => <LeaderboardRow key={agent.id} rank={index + 1} name={agent.name} value={`${agent.aht}s`} subLabel="Avg Handle Time" type="aht" isDarkMode={isDarkMode} />)}</div>
                </div>
              </div>
              <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border shadow-sm overflow-hidden`}>
                <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                    <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Analyst Performance Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-xs uppercase ${isDarkMode ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                            <tr>
                                <th className="px-6 py-3">Analyst</th>
                                <th className="px-6 py-3 text-center">Incidents Resolved</th>
                                <th className="px-6 py-3 text-center">SLA Breaches</th>
                                <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.length === 0 ? (
                                <tr><td colSpan="4" className="px-6 py-4 text-center opacity-50">No agents found.</td></tr>
                            ) : (
                                agents.map(agent => {
                                    const s = allStats[agent.id] || { incidentsResolved: 0, slaBreach: 0 };
                                    return (
                                        <tr key={agent.id} className={`border-b last:border-0 ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{agent.name}</td>
                                            <td className={`px-6 py-4 text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{s.incidentsResolved}</td>
                                            <td className={`px-6 py-4 text-center font-bold ${s.slaBreach > 0 ? 'text-red-500' : (isDarkMode ? 'text-slate-500' : 'text-slate-300')}`}>
                                                {s.slaBreach > 0 ? s.slaBreach : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {s.slaBreach === 0 && s.incidentsResolved > 0 ? (
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">On Track</span>
                                                ) : s.slaBreach > 0 ? (
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Attention</span>
                                                ) : (
                                                    <span className="opacity-50">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
          {view === 'onetoone' && (
            <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-6 h-full">
              <div className={`w-full md:w-1/3 border rounded-xl shadow-sm overflow-hidden flex flex-col ${mobileDetailOpen ? 'hidden md:flex' : 'flex'} h-full ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`p-4 border-b sticky top-0 z-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}><h3 className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Team Members</h3></div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">{agents.map(agent => (<button key={agent.id} onClick={() => { setSelectedAgent(agent); setMobileDetailOpen(true); }} className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${selectedAgent?.id === agent.id ? 'text-white' : (isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}`} style={selectedAgent?.id === agent.id ? { backgroundColor: COMPANY_THEME.accent } : {}}><span className="font-medium">{agent.name}</span><ChevronRight size={16} /></button>))}</div>
              </div>
              <div className={`w-full md:flex-1 flex flex-col gap-4 md:gap-6 overflow-hidden ${mobileDetailOpen ? 'flex' : 'hidden md:flex'} h-full`}>
                {selectedAgent ? (
                  <>
                    <div className="md:hidden flex items-center gap-2 mb-2 shrink-0"><button onClick={() => setMobileDetailOpen(false)} className={`p-2 -ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}><ArrowLeft size={20} /></button><span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedAgent.name}</span></div>
                    <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-4 rounded-xl border shadow-sm shrink-0 relative`}>
                      <div className="flex justify-between items-center mb-4"><h2 className={`text-lg md:text-xl font-bold hidden md:block ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedAgent.name}</h2><button onClick={() => { 
                        const s = allStats[selectedAgent.id] || {};
                        setEditingStats({
                          incidentsResolved: s.incidentsResolved || 0,
                          callsAnswered: s.callsAnswered || 0,
                          aht: s.aht || 0,
                          slaBreach: s.slaBreach || 0,
                          avgHold: s.avgHold || 0,
                          transfers: s.transfers || 0
                        }); 
                        setIsStatsModalOpen(true); 
                      }} className="flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: COMPANY_THEME.accent }}><Edit2 size={12} /> Edit Stats</button></div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                        {/* Explicitly render known number fields to avoid crashing on timestamps */}
                        {['incidentsResolved', 'callsAnswered', 'aht', 'slaBreach', 'avgHold', 'transfers'].map(key => {
                           const val = (allStats[selectedAgent.id] || {})[key] || 0;
                           let label = key.toUpperCase();
                           if (key === 'incidentsResolved') label = 'Incidents';
                           if (key === 'slaBreach') label = 'Breaches';
                           if (key === 'callsAnswered') label = 'Calls Taken';
                           if (key === 'avgHold') label = 'Hold Time';
                           if (key === 'transfers') label = 'Transfers';
                           
                           return (
                             <div key={key} className={`p-2 md:p-3 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                               <p className={`text-[10px] md:text-xs uppercase font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                               <p className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{val}</p>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                    <div className={`flex-1 border rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[300px] ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">{notes.map(note => (<div key={note.id} className="pl-4 py-1 border-l-4" style={{ borderLeftColor: COMPANY_THEME.accent }}><span className="text-[10px] font-bold uppercase" style={{ color: COMPANY_THEME.accent }}>{note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span><p className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{note.text}</p></div>))}</div>
                      <div className={`p-3 md:p-4 border-t shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <textarea className={`w-full border rounded-lg p-3 text-sm mb-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`} rows="2" placeholder="New note..." value={newNote} onChange={(e) => setNewNote(e.target.value)}></textarea>
                        <div className="flex gap-2"><button onClick={handleSaveNote} className="flex-1 py-2 text-white rounded-lg font-bold text-sm" style={{ backgroundColor: COMPANY_THEME.primary }}>Save Note</button><button onClick={generateAiFeedback} className="flex-1 py-2 text-white rounded-lg font-bold text-sm" style={{ backgroundColor: COMPANY_THEME.accent }}>{isGeneratingAi ? <LoadingSpinner /> : 'AI Coach ✨'}</button></div>
                      </div>
                    </div>
                  </>
                ) : ( <div className={`hidden md:flex flex-1 rounded-xl border-2 border-dashed flex-col items-center justify-center ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-400'}`}><Users size={48} opacity={0.5} /><p>Select a team member</p></div> )}
              </div>
            </div>
          )}
          {view === 'team' && <TeamView />}
          {view === 'profile' && <ProfileView />}
        </main>
      </div>
      {isAddAgentModalOpen && <AddAgentModal />}
      {isStatsModalOpen && <EditStatsModal />}
      {isReportModalOpen && <ReportModal />}
    </div>
  );
  
  function TeamView() { return <div className="space-y-6"><div className="flex justify-between items-center"><h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Team Management</h2><button onClick={() => setIsAddAgentModalOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-white" style={{ backgroundColor: COMPANY_THEME.accent }}><UserPlus size={18} /> Add</button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{agents.map(agent => (<div key={agent.id} className={`p-4 rounded-xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><div className="flex items-center gap-4"><div className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: COMPANY_THEME.primary }}>{agent.avatar}</div><div><h3 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{agent.name}</h3><p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{agent.role}</p></div></div><button onClick={(e) => handleDeleteAgent(agent.id, e)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button></div>))}</div></div>; }
  
  function ProfileView() { 
    const [localName, setLocalName] = useState(user.displayName || ''); 
    const [localRole, setLocalRole] = useState(userRole || ''); 
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Settings</h2>
        
        {/* CSV Import Card */}
        <div className={`p-6 rounded-xl border shadow-sm border-l-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} style={{ borderLeftColor: COMPANY_THEME.accent }}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}><FileSpreadsheet size={20} style={{ color: COMPANY_THEME.accent }} /> Import Data (CSV)</h3>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Upload ServiceNow (Incidents) or Genesys (Calls) exports.</p>
          
          <div className="space-y-4">
            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-opacity-50 transition-colors" style={{ borderColor: COMPANY_THEME.primary, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }}>
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} style={{ color: COMPANY_THEME.primary }} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Click to upload CSV</span>
              </div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            
            {csvSuccess && <div className="p-3 bg-green-50 text-green-700 text-xs rounded border border-green-200 flex items-center gap-2"><Check size={14} /> {csvSuccess}</div>}
            {csvError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex items-center gap-2"><AlertCircle size={14} /> {csvError}</div>}
          </div>
        </div>

        {/* Profile Details */}
        <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Profile Details</h3>
          <div className="space-y-4">
            <div><label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Name</label><input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} /></div>
            <div><label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Role</label><input type="text" value={localRole} onChange={(e) => setLocalRole(e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} /></div>
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-500"><Moon size={16} /> Dark Mode <input type="checkbox" checked={isDarkMode} onChange={toggleDarkMode} className="ml-2" /></div>
              <button onClick={() => handleUpdateProfile(localName, localRole)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: COMPANY_THEME.accent }}>Save</button>
            </div>
          </div>
        </div>
      </div>
    ); 
  }
  function AddAgentModal() { return isAddAgentModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className={`rounded-xl shadow-xl w-full max-w-md p-6 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}><h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Add Team Member</h3><form onSubmit={handleAddAgent} className="space-y-4"><input autoFocus type="text" placeholder="Full Name" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} required /><select value={newAgentRole} onChange={(e) => setNewAgentRole(e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`}><option>L1 Analyst</option><option>L2 Specialist</option><option>Team Lead</option></select><div className="flex gap-2"><button type="button" onClick={() => setIsAddAgentModalOpen(false)} className="flex-1 py-2 border rounded-lg text-slate-500">Cancel</button><button type="submit" className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: COMPANY_THEME.accent }}>Add</button></div></form></div></div>; }
  
  // Fixed EditStatsModal to only show numeric fields
  function EditStatsModal() { 
    return isStatsModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className={`rounded-xl shadow-xl w-full max-w-md p-6 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}><h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Edit Stats</h3><form onSubmit={handleSaveStats} className="space-y-4"><div className="grid grid-cols-2 gap-4">
      {['incidentsResolved', 'callsAnswered', 'aht', 'slaBreach', 'avgHold', 'transfers'].map(k => {
        let label = k.toUpperCase();
        if (k === 'incidentsResolved') label = 'Incidents';
        if (k === 'slaBreach') label = 'Breaches';
        if (k === 'callsAnswered') label = 'Calls Taken';
        if (k === 'avgHold') label = 'Hold Time (s)';
        if (k === 'transfers') label = 'Transfers';
        return (
          <div key={k}><label className="block text-xs uppercase font-bold mb-1 text-slate-500">{label}</label><input type="number" value={editingStats[k]} onChange={(e) => setEditingStats({ ...editingStats, [k]: e.target.value })} className={`w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`} /></div>
        );
      })}
    </div><div className="flex gap-2"><button type="button" onClick={() => setIsStatsModalOpen(false)} className="flex-1 py-2 border rounded-lg text-slate-500">Cancel</button><button type="submit" className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: COMPANY_THEME.accent }}>Save</button></div></form></div></div>; 
  }
  function ReportModal() { return isReportModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className={`rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col h-[80vh] md:h-auto ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}><div className="flex justify-between mb-4"><h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Weekly Report</h3><button onClick={() => setIsReportModalOpen(false)}><X size={24} className="text-slate-400" /></button></div><div className={`flex-1 border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-y-auto mb-4 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>{reportText}</div><button onClick={copyReportToClipboard} className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2" style={{ backgroundColor: copied ? '#16a34a' : COMPANY_THEME.accent }}>{copied ? <Check size={20} /> : <Clipboard size={20} />}{copied ? 'Copied!' : 'Copy Text'}</button></div></div>; }
}

export default function ServiceDeskApp() {
  return (
    <ErrorBoundary>
      <ServiceDeskLogic />
    </ErrorBoundary>
  );
}