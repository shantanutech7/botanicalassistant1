import { useState, useRef, useEffect } from "react";

const TABS = ["Analyze", "Chat", "History"];

const SYSTEM_PROMPT = `You are BotaniAI, an expert botanical research assistant with deep knowledge of:
- Plant species identification and taxonomy
- Plant diseases, symptoms, and treatments
- Medicinal properties and traditional uses
- Scientific research and botanical studies

When analyzing plant images, provide:
1. **Species Identification**: Common name, scientific name, family
2. **Plant Health**: Disease detection, symptoms, severity (Healthy/Mild/Moderate/Severe)
3. **Medicinal Properties**: Traditional uses, active compounds, benefits
4. **Care Recommendations**: Watering, light, soil, temperature
5. **Research Notes**: Interesting botanical facts

Format your response with clear sections using **bold headers**.
Be precise, scientific yet accessible. If uncertain about identification, mention confidence level.`;

function MessageBubble({ msg }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: msg.role === "user" ? "row-reverse" : "row",
      gap: 10,
      marginBottom: 16,
      alignItems: "flex-start"
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: msg.role === "user" ? "#1D9E75" : "#EAF3DE",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 14,
        color: msg.role === "user" ? "#fff" : "#27500A",
        fontWeight: 500
      }}>
        {msg.role === "user" ? "U" : "🌿"}
      </div>
      <div style={{ maxWidth: "80%" }}>
        {msg.image && (
          <img src={msg.image} alt="plant" style={{
            width: "100%", maxWidth: 240, borderRadius: 10,
            marginBottom: 8, display: "block",
            border: "0.5px solid var(--color-border-tertiary)"
          }} />
        )}
        <div style={{
          background: msg.role === "user" ? "#1D9E75" : "var(--color-background-secondary)",
          color: msg.role === "user" ? "#fff" : "var(--color-text-primary)",
          borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.6,
          border: msg.role === "assistant" ? "0.5px solid var(--color-border-tertiary)" : "none",
          whiteSpace: "pre-wrap"
        }}>
          {msg.content}
        </div>
        {msg.role === "assistant" && msg.tags && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {msg.tags.map(t => (
              <span key={t} style={{
                fontSize: 11, padding: "3px 9px",
                background: "#EAF3DE", color: "#3B6D11",
                borderRadius: 20, border: "0.5px solid #C0DD97"
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthBadge({ level }) {
  const colors = {
    Healthy: { bg: "#EAF3DE", text: "#27500A", border: "#C0DD97" },
    Mild: { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
    Moderate: { bg: "#FAECE7", text: "#4A1B0C", border: "#F5C4B3" },
    Severe: { bg: "#FCEBEB", text: "#501313", border: "#F7C1C1" },
    Unknown: { bg: "var(--color-background-secondary)", text: "var(--color-text-secondary)", border: "var(--color-border-tertiary)" }
  };
  const c = colors[level] || colors.Unknown;
  return (
    <span style={{
      fontSize: 12, padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      fontWeight: 500
    }}>● {level}</span>
  );
}

export default function BotanicalAssistant() {
  const [activeTab, setActiveTab] = useState("Analyze");
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Namaste! 🌿 Main BotaniAI hoon — aapka botanical research assistant. Koi bhi plant ke baare mein poochein, ya analyze karne ke liye photo upload karein.", tags: [] }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const chatEndRef = useRef();
  const chatHistoryRef = useRef([]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setImage(e.target.result);
      setImageBase64(e.target.result.split(",")[1]);
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyzePlant() {
    if (!imageBase64) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
              { type: "text", text: "Please analyze this plant image. Identify the species, check for diseases, provide medicinal properties, and give care recommendations." }
            ]
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Analysis failed.";
      const result = { text, timestamp: new Date(), imageUrl: image };
      setAnalysisResult(result);
      setHistory(h => [result, ...h].slice(0, 20));
      const healthMatch = text.match(/healthy|mild|moderate|severe/i);
      result.health = healthMatch ? healthMatch[0].charAt(0).toUpperCase() + healthMatch[0].slice(1).toLowerCase() : "Unknown";
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: chatHistoryRef.current
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Sorry, kuch error hua.";
      const aiMsg = { role: "assistant", content: text, tags: extractTags(text) };
      setChatMessages(m => [...m, aiMsg]);
      chatHistoryRef.current = [...chatHistoryRef.current, { role: "assistant", content: text }];
    } catch (e) {
      setChatMessages(m => [...m, { role: "assistant", content: "Network error: " + e.message, tags: [] }]);
    }
    setChatLoading(false);
  }

  function extractTags(text) {
    const tags = [];
    if (/medicin|herb|ayurved|treatment/i.test(text)) tags.push("Medicinal");
    if (/disease|infect|fungal|bacterial/i.test(text)) tags.push("Disease");
    if (/species|scientific|taxonomy/i.test(text)) tags.push("Species");
    if (/care|water|sunlight|soil/i.test(text)) tags.push("Care Tips");
    return tags;
  }

  const quickPrompts = [
    "Neem ke medicinal properties kya hain?",
    "Tulsi (Holy Basil) ke fayde batao",
    "Rose plant mein black spots kyun aate hain?",
    "Aloe vera ka scientific naam kya hai?"
  ];

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "1rem 0", maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#EAF3DE", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 22
        }}>🌿</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>BotaniAI</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Smart Botanical Research Assistant</p>
        </div>
        <span style={{
          marginLeft: "auto", fontSize: 11, padding: "3px 10px",
          background: "#EAF3DE", color: "#27500A", borderRadius: 20,
          border: "0.5px solid #C0DD97"
        }}>Phase 1 · Live</span>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background: "none", border: "none", padding: "8px 20px",
            fontSize: 14, cursor: "pointer",
            color: activeTab === t ? "#1D9E75" : "var(--color-text-secondary)",
            borderBottom: activeTab === t ? "2px solid #1D9E75" : "2px solid transparent",
            fontWeight: activeTab === t ? 500 : 400,
            transition: "all 0.15s"
          }}>{t}</button>
        ))}
      </div>

      {activeTab === "Analyze" && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? "#1D9E75" : "var(--color-border-tertiary)"}`,
              borderRadius: "var(--border-radius-lg)",
              padding: "2rem",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "#EAF3DE" : "var(--color-background-secondary)",
              transition: "all 0.2s",
              marginBottom: 16
            }}
          >
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
            {image ? (
              <div>
                <img src={image} alt="plant" style={{
                  maxHeight: 200, maxWidth: "100%", borderRadius: 10, marginBottom: 10
                }} />
                <p style={{ fontSize: 13, color: "#1D9E75", margin: 0 }}>Image ready — click to change</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
                <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Plant photo upload karo</p>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Drag & drop ya click to browse · JPG, PNG, WEBP</p>
              </div>
            )}
          </div>

          {image && (
            <button onClick={analyzePlant} disabled={analyzing} style={{
              width: "100%", padding: "12px",
              background: analyzing ? "var(--color-background-secondary)" : "#1D9E75",
              color: analyzing ? "var(--color-text-secondary)" : "#fff",
              border: "none", borderRadius: "var(--border-radius-md)",
              fontSize: 15, fontWeight: 500, cursor: analyzing ? "not-allowed" : "pointer",
              transition: "all 0.2s", marginBottom: 16
            }}>
              {analyzing ? "🔬 Analyzing plant..." : "🔍 Analyze Plant"}
            </button>
          )}

          {analysisResult && (
            <div style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              overflow: "hidden"
            }}>
              <div style={{
                padding: "12px 16px",
                background: "#EAF3DE",
                borderBottom: "0.5px solid #C0DD97",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#27500A" }}>Analysis Result</span>
                <HealthBadge level={analysisResult.health} />
              </div>
              <div style={{ padding: "16px", fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                {analysisResult.text}
              </div>
              <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8 }}>
                <button onClick={() => { setActiveTab("Chat"); }} style={{
                  fontSize: 12, padding: "5px 12px",
                  background: "#EAF3DE", color: "#27500A",
                  border: "0.5px solid #C0DD97", borderRadius: "var(--border-radius-md)", cursor: "pointer"
                }}>💬 Ask follow-up</button>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: "auto", display: "flex", alignItems: "center" }}>
                  {analysisResult.timestamp?.toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "Chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: 460 }}>
          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, marginBottom: 12 }}>
            {chatMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {chatLoading && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🌿</div>
                <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "14px 14px 14px 4px", padding: "10px 14px" }}>
                  <span style={{ fontSize: 18, letterSpacing: 4 }}>···</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {chatMessages.length === 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => { setChatInput(p); }} style={{
                  fontSize: 12, padding: "5px 11px", background: "var(--color-background-secondary)",
                  border: "0.5px solid var(--color-border-tertiary)", borderRadius: 20,
                  cursor: "pointer", color: "var(--color-text-secondary)"
                }}>{p}</button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Plant ke baare mein kuch bhi poochein..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--border-radius-md)", fontSize: 14 }}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
              padding: "10px 16px",
              background: chatLoading || !chatInput.trim() ? "var(--color-background-secondary)" : "#1D9E75",
              color: chatLoading || !chatInput.trim() ? "var(--color-text-secondary)" : "#fff",
              border: "none", borderRadius: "var(--border-radius-md)",
              cursor: "pointer", fontSize: 14
            }}>Send</button>
          </div>
        </div>
      )}

      {activeTab === "History" && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
              <p style={{ fontSize: 15, color: "var(--color-text-secondary)", margin: 0 }}>Abhi tak koi analysis nahi hua</p>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>Analyze tab mein jaake koi plant photo upload karo</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  background: "var(--color-background-primary)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "12px 14px",
                  display: "flex", gap: 12, alignItems: "flex-start"
                }}>
                  {h.imageUrl && <img src={h.imageUrl} alt="plant" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <HealthBadge level={h.health || "Unknown"} />
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{h.timestamp?.toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.text?.slice(0, 120)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
