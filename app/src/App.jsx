import { useState, useRef, useEffect } from "react";

const TABS = ["Analyze", "Chat", "History"];
const BACKEND = "http://localhost:5000";

function HealthBadge({ level }) {
  const colors = {
    Healthy: { bg: "#EAF3DE", text: "#27500A" },
    Mild: { bg: "#FAEEDA", text: "#633806" },
    Moderate: { bg: "#FAECE7", text: "#4A1B0C" },
    Severe: { bg: "#FCEBEB", text: "#501313" },
    Unknown: { bg: "#F0F0F0", text: "#666" }
  };
  const c = colors[level] || colors.Unknown;
  return <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.text, fontWeight: 500 }}>● {level}</span>;
}

export default function BotanicalAssistant() {
  const [activeTab, setActiveTab] = useState("Analyze");
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [yoloResult, setYoloResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([{ role: "assistant", content: "Namaste! 🌿 Main BotaniAI hoon. Koi bhi plant ke baare mein poochein!" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const chatHistoryRef = useRef([]);
  const chatEndRef = useRef();
  const fileRef = useRef();

  useEffect(() => {
    fetch(`${BACKEND}/health`)
      .then(r => r.json())
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setImage(e.target.result);
      setImageBase64(e.target.result);
      setAnalysisResult(null);
      setYoloResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyzePlant() {
    if (!imageBase64) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setYoloResult(null);
    try {
      const yoloRes = await fetch(`${BACKEND}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 })
      });
      const yoloData = await yoloRes.json();
      if (yoloData.success) setYoloResult(yoloData);
    } catch (e) { console.log("YOLO error:", e); }
    try {
      const claudeRes = await fetch(`${BACKEND}/claude-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 })
      });
      const claudeData = await claudeRes.json();
      const result = { text: claudeData.result || claudeData.error || "Analysis complete.", timestamp: new Date(), health: yoloData?.health_analysis?.health_status || "Unknown" };
      setAnalysisResult(result);
      setHistory(h => [{ ...result, imageUrl: image }, ...h].slice(0, 20));
    } catch (e) {
      setAnalysisResult({ text: "Error: " + e.message, timestamp: new Date(), health: "Unknown" });
    }
    setAnalyzing(false);
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages(m => [...m, userMsg]);
    chatHistoryRef.current = [...chatHistoryRef.current, { role: "user", content: chatInput }];
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND}/claude-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistoryRef.current, system: "You are BotaniAI, an expert botanical research assistant." })
      });
      const data = await res.json();
      const text = data.result || "Sorry, kuch error hua.";
      setChatMessages(m => [...m, { role: "assistant", content: text }]);
      chatHistoryRef.current = [...chatHistoryRef.current, { role: "assistant", content: text }];
    } catch (e) {
      setChatMessages(m => [...m, { role: "assistant", content: "Error: " + e.message }]);
    }
    setChatLoading(false);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1rem", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌿</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>BotaniAI</h1>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Smart Botanical Research Assistant</p>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", background: backendStatus === "online" ? "#EAF3DE" : "#FCEBEB", color: backendStatus === "online" ? "#27500A" : "#501313", borderRadius: 20 }}>
          {backendStatus === "online" ? "● Backend Online" : "● Backend Offline"}
        </span>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ background: "none", border: "none", padding: "8px 20px", fontSize: 14, cursor: "pointer", color: activeTab === t ? "#1D9E75" : "#666", borderBottom: activeTab === t ? "2px solid #1D9E75" : "2px solid transparent", fontWeight: activeTab === t ? 600 : 400 }}>{t}</button>
        ))}
      </div>

      {activeTab === "Analyze" && (
        <div>
          <div onClick={() => fileRef.current.click()} style={{ border: "2px dashed #ccc", borderRadius: 12, padding: "2rem", textAlign: "center", cursor: "pointer", background: "#FAFAFA", marginBottom: 16 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            {image ? (
              <div><img src={image} alt="plant" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 10, marginBottom: 10 }} /><p style={{ fontSize: 13, color: "#1D9E75", margin: 0 }}>✓ Image ready</p></div>
            ) : (
              <div><div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div><p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 4px" }}>Plant photo upload karo</p><p style={{ fontSize: 13, color: "#888", margin: 0 }}>Click to browse · JPG, PNG, WEBP</p></div>
            )}
          </div>
          {image && <button onClick={analyzePlant} disabled={analyzing} style={{ width: "100%", padding: 12, background: analyzing ? "#ccc" : "#1D9E75", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: analyzing ? "not-allowed" : "pointer", marginBottom: 16 }}>{analyzing ? "🔬 Analyzing..." : "🔍 Analyze Plant"}</button>}
          {yoloResult && (
            <div style={{ background: "#F0F7FF", border: "1px solid #C0D8F5", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: "#0C447C", marginBottom: 8 }}>🤖 YOLOv8 Disease Detection</div>
              <HealthBadge level={yoloResult.health_analysis?.health_status} />
              <span style={{ fontSize: 12, marginLeft: 8 }}>{yoloResult.health_analysis?.possible_disease}</span>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>{yoloResult.recommendations?.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {analysisResult && (
            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#EAF3DE", borderBottom: "1px solid #C0DD97", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#27500A" }}>🌿 Claude AI Analysis</span>
                <HealthBadge level={analysisResult.health} />
              </div>
              <div style={{ padding: 16, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysisResult.text}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === "Chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: 460 }}>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: msg.role === "user" ? "#1D9E75" : "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: msg.role === "user" ? "#fff" : "#27500A" }}>{msg.role === "user" ? "U" : "🌿"}</div>
                <div style={{ maxWidth: "80%", background: msg.role === "user" ? "#1D9E75" : "#F5F5F5", color: msg.role === "user" ? "#fff" : "#222", borderRadius: 12, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</div>
              </div>
            ))}
            {chatLoading && <div style={{ padding: 10, color: "#888" }}>🌿 Typing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Plant ke baare mein poochein..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14 }} />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ padding: "10px 16px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}>Send</button>
          </div>
        </div>
      )}

      {activeTab === "History" && (
        <div>
          {history.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: "#888" }}><div style={{ fontSize: 40 }}>🔬</div><p>Koi analysis nahi hua abhi tak</p></div>
            : history.map((h, i) => (
              <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, marginBottom: 10, display: "flex", gap: 12 }}>
                {h.imageUrl && <img src={h.imageUrl} alt="plant" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />}
                <div><HealthBadge level={h.health} /><p style={{ fontSize: 13, color: "#666", margin: "6px 0 0" }}>{h.text?.slice(0, 100)}...</p></div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}