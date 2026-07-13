import { useState, useEffect } from "react";
import { T, font, InputField, Btn } from "./p2_helpers.jsx";

export function SettingsPanel({ onClose, isAdmin, user }) {
  const [systemName, setSystemName] = useState("PropNest");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [countryCode, setCountryCode] = useState("263");
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [repairingCoverage, setRepairingCoverage] = useState(false);

  // Mock properties for demo
  const [properties, setProperties] = useState([
    { id: 1, name: "Maple Court", color: "#F59E0B" },
    { id: 2, name: "Oakwood", color: "#3B82F6" },
    { id: 3, name: "Birchgate", color: "#10B981" },
    { id: 4, name: "Cedar House", color: "#8B5CF6" }
  ]);

  // Load settings on mount
  useEffect(() => {
    // In real app, load from Supabase settings table
    setAllowedEmails(["admin@propnest.app", "manager@propnest.app"]);
  }, []);

  const handleSaveSystem = async () => {
    setLoading(true);
    // In real app: upsert to settings table
    setTimeout(() => {
      setLoading(false);
      alert("System settings saved!");
    }, 500);
  };

  const handleAddEmail = () => {
    if (newEmail && !allowedEmails.includes(newEmail)) {
      setAllowedEmails([...allowedEmails, newEmail]);
      setNewEmail("");
      // In real app: save to settings table
    }
  };

  const handleRemoveEmail = (email) => {
    if (email === user?.email) {
      alert("Cannot remove your own email!");
      return;
    }
    setAllowedEmails(allowedEmails.filter(e => e !== email));
    // In real app: save to settings table
  };

  const handleClearSnapshots = () => {
    if (confirm("Clear all monthly snapshots? This cannot be undone.")) {
      alert("Monthly snapshots cleared!");
      // In real app: DELETE FROM monthly_snapshots
    }
  };

  const handleRegenerateObligations = () => {
    if (confirm("Regenerate all obligations? This will recalculate all student obligations.")) {
      alert("Obligations regenerated!");
      // In real app: call generateObligations service
    }
  };

  const handleRepairCoverage = async () => {
    if (!confirm("Repair coverage for ALL active students?\n\nThis will rebuild coverage from payment history for students affected by the old payment flow.\n\nThis operation is safe and can take 10-30 seconds.")) {
      return;
    }

    setRepairingCoverage(true);
    
    try {
      const { repairAllStudentsCoverage } = await import('../services/coverageRepairService.js');
      const result = await repairAllStudentsCoverage();
      
      if (result.success) {
        alert(`✓ Coverage repair complete!\n\n${result.repaired} students repaired\n${result.failed} failed\n\nPlease refresh the page to see updated coverage.`);
      } else {
        alert(`⚠ Coverage repair completed with errors:\n\n${result.repaired} students repaired\n${result.failed} failed\n\nErrors:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      alert(`✗ Coverage repair failed: ${error.message}`);
      console.error('[Settings] Coverage repair failed:', error);
    } finally {
      setRepairingCoverage(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div onClick={onClose} style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,.6)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "flex-end", 
      zIndex: 1000 
    }}>
      <div onClick={e => e.stopPropagation()} 
        style={{ 
          width: 480, 
          maxWidth: "100%", 
          height: "100vh", 
          background: T.card, 
          borderLeft: `1px solid ${T.border}`, 
          overflowY: "auto",
          animation: "slideInRight .3s ease"
        }}>
        
        {/* Header */}
        <div style={{ 
          padding: "24px", 
          borderBottom: `1px solid ${T.border}`, 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>Settings</h2>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>System configuration</div>
          </div>
          <button onClick={onClose} style={{ 
            background: "none", 
            border: "none", 
            color: T.muted, 
            cursor: "pointer", 
            fontSize: 20 
          }}>✕</button>
        </div>

        <div style={{ padding: "24px" }}>
          
          {/* 1. System Settings */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>🏢 System</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <InputField 
                label="System Name" 
                value={systemName} 
                onChange={setSystemName} 
                placeholder="PropNest" 
              />
              <InputField 
                label="Currency Symbol" 
                value={currencySymbol} 
                onChange={setCurrencySymbol} 
                placeholder="$" 
              />
              <InputField 
                label="Country Phone Code" 
                value={countryCode} 
                onChange={setCountryCode} 
                placeholder="263" 
              />
              <Btn 
                accent={T.gold} 
                onClick={handleSaveSystem} 
                disabled={loading}
                style={{ alignSelf: "flex-start", marginTop: 8 }}
              >
                {loading ? "Saving..." : "Save System Settings"}
              </Btn>
            </div>
          </div>

          {/* 2. Allowed Logins */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>🔐 Allowed Logins</h3>
            
            {/* Email chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {allowedEmails.map(email => (
                <div key={email} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6, 
                  background: T.surface, 
                  border: `1px solid ${T.border}`, 
                  borderRadius: 20, 
                  padding: "6px 12px" 
                }}>
                  <span style={{ fontSize: 12, color: T.text }}>{email}</span>
                  {email !== user?.email && (
                    <button onClick={() => handleRemoveEmail(email)} style={{ 
                      background: "none", 
                      border: "none", 
                      color: T.red, 
                      cursor: "pointer", 
                      fontSize: 14 
                    }}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {/* Add email */}
            <div style={{ display: "flex", gap: 8 }}>
              <InputField 
                value={newEmail} 
                onChange={setNewEmail} 
                placeholder="admin@example.com" 
                style={{ flex: 1 }}
              />
              <Btn accent={T.green} onClick={handleAddEmail}>Add</Btn>
            </div>
          </div>

          {/* 3. Properties */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>🏠 Properties</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {properties.map(prop => (
                <div key={prop.id} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px", 
                  background: T.surface, 
                  border: `1px solid ${T.border}`, 
                  borderRadius: 10 
                }}>
                  <div style={{ 
                    width: 16, 
                    height: 16, 
                    borderRadius: "50%", 
                    background: prop.color 
                  }} />
                  <input 
                    value={prop.name} 
                    onChange={e => setProperties(properties.map(p => 
                      p.id === prop.id ? { ...p, name: e.target.value } : p
                    ))}
                    style={{ 
                      flex: 1, 
                      background: "none", 
                      border: "none", 
                      color: T.text, 
                      fontSize: 13, 
                      fontFamily: font 
                    }}
                  />
                  <input 
                    type="color" 
                    value={prop.color} 
                    onChange={e => setProperties(properties.map(p => 
                      p.id === prop.id ? { ...p, color: e.target.value } : p
                    ))}
                    style={{ width: 32, height: 24, border: "none", borderRadius: 4 }}
                  />
                  <Btn accent={T.blue} style={{ fontSize: 11, padding: "4px 8px" }}>Save</Btn>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Danger Zone */}
          <div style={{ 
            border: `2px solid ${T.red}`, 
            borderRadius: 12, 
            padding: 20, 
            background: `${T.red}05` 
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.red, marginBottom: 16 }}>⚠️ Danger Zone</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Repair Coverage Data</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Fix students with stale coverage from old payment flow (Phase 4B.3)</div>
                </div>
                <Btn accent={T.green} onClick={handleRepairCoverage} disabled={repairingCoverage} style={{ fontSize: 11 }}>
                  {repairingCoverage ? 'Repairing...' : 'Repair All'}
                </Btn>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Clear Monthly Snapshots</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Remove all saved monthly data snapshots</div>
                </div>
                <Btn accent={T.red} onClick={handleClearSnapshots} style={{ fontSize: 11 }}>Clear</Btn>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Regenerate All Obligations</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Recalculate all student payment obligations</div>
                </div>
                <Btn accent={T.amber} onClick={handleRegenerateObligations} style={{ fontSize: 11 }}>Regenerate</Btn>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}