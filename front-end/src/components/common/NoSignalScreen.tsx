import React, { useState, useEffect, useRef } from 'react';
import { 
  WifiOff, 
  RefreshCw, 
  ServerOff, 
  Database, 
  Terminal, 
  Sliders, 
  CheckCircle2, 
  Sparkles, 
  Tv, 
  Activity, 
  ExternalLink,
  Radio
} from 'lucide-react';
import { api, getApiBaseUrl, setApiBaseUrl } from '../../services/api';

interface NoSignalScreenProps {
  onConnected: () => void;
  initialError?: string;
}

export const NoSignalScreen: React.FC<NoSignalScreenProps> = ({ onConnected, initialError }) => {
  const [currentUrl, setCurrentUrl] = useState<string>(getApiBaseUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(true);
  const [tempUrl, setTempUrl] = useState(currentUrl);
  
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string>(initialError || 'No connection to host server or database.');
  const [countdown, setCountdown] = useState<number>(4);
  const [showGuide, setShowGuide] = useState(false);
  const [radarPulse, setRadarPulse] = useState(0);

  const countdownRef = useRef<number>(4);

  // Health check handler
  const performCheck = async (targetUrl?: string) => {
    setIsChecking(true);
    setRadarPulse(p => p + 1);
    try {
      const res = await api.checkHealth();
      if (res.status === 'ok') {
        onConnected();
        return true;
      } else {
        setLastError(res.message || 'Server replied with error or database is disconnected');
        return false;
      }
    } catch (e: any) {
      setLastError(e?.message || 'Cannot reach host server');
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-retry polling loop
  useEffect(() => {
    countdownRef.current = 4;
    setCountdown(4);

    const interval = setInterval(async () => {
      if (isChecking) return;

      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        countdownRef.current = 4;
        setCountdown(4);
        await performCheck();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUrl.trim()) return;
    const cleanUrl = tempUrl.trim();
    setApiBaseUrl(cleanUrl);
    setCurrentUrl(cleanUrl);
    try {
      await fetch('/api/save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_url: cleanUrl })
      });
    } catch {
      // Ignored if offline or direct web
    }
    countdownRef.current = 2;
    setCountdown(2);
    await performCheck(cleanUrl);
  };

  return (
    <div className="relative min-h-screen w-screen overflow-y-auto bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
      {/* CRT Scanline & Vintage TV Signal Background Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-20 z-0 bg-repeat"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))',
          backgroundSize: '100% 4px, 6px 100%'
        }}
      />

      {/* Subtle pulsing ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center">
        
        {/* Connection Standby Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md mb-6 shadow-lg">
          <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">
            CONNECTION STANDBY
          </span>
        </div>

        {/* Big Radar / Signal Pulse Centerpiece */}
        <div className="relative flex items-center justify-center my-4">
          {/* Animated radar sonar circles */}
          <div className="absolute w-36 h-36 rounded-full border border-red-500/20 animate-ping opacity-60" />
          <div className="absolute w-28 h-28 rounded-full border border-red-500/30 animate-pulse" />
          
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-b from-red-950/80 to-black border-2 border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.35)] flex items-center justify-center">
            <WifiOff className="w-11 h-11 text-red-400 stroke-[2.2]" />
            <span className="absolute -top-2 -right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-black" />
            </span>
          </div>
        </div>

        {/* Glitch Title */}
        <div className="text-center mt-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-3">
            <span className="text-red-500 font-mono tracking-wider">NO SIGNAL</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md font-medium">
            The UserBot server and database are not being hosted or are unreachable.
          </p>
        </div>

        {/* Live Diagnostics Card */}
        <div className="w-full mt-6 bg-[#131317]/90 border border-zinc-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
          
          {/* Status Headers */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 text-xs">
            <div className="flex items-center gap-2 text-zinc-400 font-mono">
              <Activity className="w-4 h-4 text-red-400" />
              <span>STATUS:</span>
              <span className="text-red-400 font-bold uppercase">DISCONNECTED</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
              <Radio className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
              <span>AUTO-PROBE IN {countdown}s</span>
            </div>
          </div>

          {/* Details list */}
          <div className="mt-3.5 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800/60 gap-1.5">
              <div className="flex items-center gap-2 text-zinc-400">
                <ServerOff className="w-4 h-4 text-zinc-500" />
                <span className="font-semibold text-zinc-300">Target Host:</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-zinc-200 font-mono text-xs bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                  {currentUrl}
                </code>
                <button
                  onClick={() => {
                    setTempUrl(currentUrl);
                    setIsEditingUrl(!isEditingUrl);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  {isEditingUrl ? 'Cancel' : 'Change'}
                </button>
              </div>
            </div>

            {/* Editable Server URL Field */}
            {isEditingUrl && (
              <form onSubmit={handleSaveUrl} className="p-3 bg-zinc-900/90 border border-blue-500/40 rounded-xl space-y-2 animate-in fade-in duration-150">
                <label className="text-[11px] font-medium text-zinc-300 block">
                  Company Server Address (Domain, Public IP, or Local IP):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="https://chat.company.com or http://192.168.1.100:8000"
                    className="flex-1 px-3 py-1.5 bg-black/60 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap"
                  >
                    Save & Connect
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300/90">
              <Database className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <div className="font-semibold text-red-200">Database & API Probe:</div>
                <div className="font-mono text-[11px] text-red-300/80">{lastError}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => performCheck()}
              disabled={isChecking}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-xs tracking-wide shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Probing Host...' : 'Retry Connection Now'}</span>
            </button>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition"
            >
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span>{showGuide ? 'Hide Instructions' : 'How to Host Server'}</span>
            </button>
          </div>

          {/* Instructions Drawer */}
          {showGuide && (
            <div className="mt-4 p-4 rounded-xl bg-black/60 border border-zinc-700/60 text-xs text-zinc-300 space-y-3 animate-in fade-in duration-200">
              <div className="font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Network Reachability & Server Hosting Guide:</span>
              </div>
              <div className="space-y-2.5 text-zinc-400 text-[11px] leading-relaxed">
                <div>
                  <strong className="text-zinc-200">1. Production / Remote VPS (Recommended):</strong>
                  <div className="text-zinc-400 mt-0.5">
                    Point your domain (e.g. <code className="text-blue-300 font-mono">chat.company.com</code>) to your server's public IP. Nginx reverse-proxies port 443 (HTTPS/WSS) to Daphne.
                  </div>
                </div>
                <div>
                  <strong className="text-zinc-200">2. Verify Reachability (PowerShell on Client):</strong>
                  <div className="mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800 font-mono text-emerald-400 select-text overflow-x-auto text-[10.5px]">
                    Test-NetConnection {currentUrl.replace(/^https?:\/\//, '').split(':')[0] || 'chat.yourdomain.com'} -Port {currentUrl.startsWith('https://') ? '443' : '8000'}
                  </div>
                </div>
                <div>
                  <strong className="text-zinc-200">3. Local Development:</strong>
                  <div className="mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800 font-mono text-zinc-300 select-text overflow-x-auto text-[10.5px]">
                    cd backend && python manage.py runserver 0.0.0.0:8000
                  </div>
                </div>
                <div className="text-emerald-400/90 font-medium">
                  ✓ Sockets reconnect with exponential backoff & jitter. Unsent messages buffer offline automatically.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-zinc-400 font-mono">
          UserBot Chat Desktop Client • Standby Mode
        </div>
      </div>
    </div>
  );
};
