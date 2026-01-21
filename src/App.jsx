import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Copy, Zap, Trash2, CheckCircle, Calendar, Mail, Globe } from 'lucide-react';

// Timezone data
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

const TZ_PATTERNS = [
  { pattern: /\b(PST|PDT|Pacific)\b/i, tz: 'America/Los_Angeles' },
  { pattern: /\b(MST|MDT|Mountain)\b/i, tz: 'America/Denver' },
  { pattern: /\b(CST|CDT|Central)\b/i, tz: 'America/Chicago' },
  { pattern: /\b(EST|EDT|Eastern)\b/i, tz: 'America/New_York' },
  { pattern: /\b(GMT|BST|London|UK)\b/i, tz: 'Europe/London' },
  { pattern: /\b(CET|CEST|Paris|Berlin|Europe)\b/i, tz: 'Europe/Paris' },
  { pattern: /\b(JST|Tokyo|Japan)\b/i, tz: 'Asia/Tokyo' },
  { pattern: /\b(IST|India|Mumbai)\b/i, tz: 'Asia/Kolkata' },
  { pattern: /\b(SGT|Singapore)\b/i, tz: 'Asia/Singapore' },
  { pattern: /\b(AEST|AEDT|Sydney|Australia)\b/i, tz: 'Australia/Sydney' },
];

const WINDOW_PATTERNS = [
  { pattern: /this week/i, value: 'This week' },
  { pattern: /next week/i, value: 'Next week' },
  { pattern: /tomorrow/i, value: 'Tomorrow' },
  { pattern: /today/i, value: 'Today' },
  { pattern: /(monday|tuesday|wednesday|thursday|friday)/i, value: 'Specific day' },
  { pattern: /morning/i, value: 'Morning preferred' },
  { pattern: /afternoon/i, value: 'Afternoon preferred' },
  { pattern: /evening/i, value: 'Evening preferred' },
];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function App() {
  const myTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const [emailText, setEmailText] = useState('');
  const [parsedInfo, setParsedInfo] = useState({ tz: null, window: 'Flexible', sender: 'Unknown' });
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [openSlots, setOpenSlots] = useState(() => {
    const saved = localStorage.getItem('availability-open-slots');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [outputTimezone, setOutputTimezone] = useState('America/New_York');
  const [showToast, setShowToast] = useState(false);

  // Save open slots to localStorage
  useEffect(() => {
    localStorage.setItem('availability-open-slots', JSON.stringify([...openSlots]));
  }, [openSlots]);

  // Parse email when text changes
  useEffect(() => {
    if (!emailText.trim()) {
      setParsedInfo({ tz: null, window: 'Flexible', sender: 'Unknown' });
      return;
    }

    // Detect timezone
    let detectedTz = null;
    for (const { pattern, tz } of TZ_PATTERNS) {
      if (pattern.test(emailText)) {
        detectedTz = tz;
        break;
      }
    }
    if (detectedTz) {
      setOutputTimezone(detectedTz);
    }

    // Detect time window
    let detectedWindow = 'Flexible';
    for (const { pattern, value } of WINDOW_PATTERNS) {
      if (pattern.test(emailText)) {
        detectedWindow = value;
        break;
      }
    }

    // Detect sender
    const namePatterns = [
      /(?:Best|Thanks|Regards|Cheers),?\s*\n\s*([A-Z][a-z]+)/,
      /^From:\s*([A-Z][a-z]+)/m,
      /(?:Hi|Hello),?\s*(?:I'm|I am)\s+([A-Z][a-z]+)/i,
    ];
    let sender = 'Unknown';
    for (const pattern of namePatterns) {
      const match = emailText.match(pattern);
      if (match) {
        sender = match[1];
        break;
      }
    }

    setParsedInfo({ tz: detectedTz, window: detectedWindow, sender });
  }, [emailText]);

  const toggleSlot = useCallback((slotKey) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.add(slotKey);
        // Also mark as open
        setOpenSlots(o => new Set([...o, slotKey]));
      }
      return next;
    });
  }, []);

  const toggleOpen = useCallback((slotKey) => {
    setOpenSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotKey)) {
        next.delete(slotKey);
        setSelectedSlots(s => {
          const ns = new Set(s);
          ns.delete(slotKey);
          return ns;
        });
      } else {
        next.add(slotKey);
      }
      return next;
    });
  }, []);

  const markBusinessHours = () => {
    const newOpen = new Set(openSlots);
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      for (let hour = 9; hour < 17; hour++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(hour, 0, 0, 0);
        newOpen.add(date.toISOString());
      }
    }
    setOpenSlots(newOpen);
  };

  const clearAll = () => {
    setOpenSlots(new Set());
    setSelectedSlots(new Set());
  };

  const selectAllOpen = () => {
    setSelectedSlots(new Set(openSlots));
  };

  const generateOutput = () => {
    if (selectedSlots.size === 0) {
      return 'Select time slots from your calendar to generate availability in the recipient\'s timezone.';
    }

    const slotsByDay = {};
    const sortedSlots = Array.from(selectedSlots).sort();

    sortedSlots.forEach(slot => {
      const date = new Date(slot);
      const dayKey = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        timeZone: outputTimezone 
      });
      
      if (!slotsByDay[dayKey]) {
        slotsByDay[dayKey] = [];
      }
      slotsByDay[dayKey].push(date);
    });

    const tzName = new Intl.DateTimeFormat('en-US', { timeZone: outputTimezone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(part => part.type === 'timeZoneName')?.value || outputTimezone;

    let output = `Here are my available times (${tzName}):\n\n`;

    Object.entries(slotsByDay).forEach(([day, times]) => {
      times.sort((a, b) => a - b);
      
      const ranges = [];
      let rangeStart = times[0];
      let rangeEnd = times[0];

      for (let i = 1; i < times.length; i++) {
        const diff = (times[i] - rangeEnd) / (1000 * 60 * 60);
        if (diff <= 1) {
          rangeEnd = times[i];
        } else {
          ranges.push([rangeStart, rangeEnd]);
          rangeStart = times[i];
          rangeEnd = times[i];
        }
      }
      ranges.push([rangeStart, rangeEnd]);

      const rangeStrings = ranges.map(([start, end]) => {
        const endPlusHour = new Date(end);
        endPlusHour.setHours(endPlusHour.getHours() + 1);
        
        const startStr = start.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: outputTimezone 
        });
        const endStr = endPlusHour.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: outputTimezone 
        });
        return `${startStr} - ${endStr}`;
      });

      output += `• ${day}\n  ${rangeStrings.join('\n  ')}\n\n`;
    });

    output += `Let me know what works best for you!`;
    return output;
  };

  const copyOutput = async () => {
    const output = generateOutput();
    await navigator.clipboard.writeText(output);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // Generate week days
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();

  const prevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const endDate = new Date(currentWeekStart);
  endDate.setDate(endDate.getDate() + 6);
  const weekLabel = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="noise" />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <header className="mb-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-4xl mb-2" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            Availability <span style={{ color: 'var(--accent)' }}>Converter</span>
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Parse emails → Select times → Convert to their timezone
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email Input Panel */}
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                <Mail className="w-3 h-3" />
                Email Input
              </span>
              <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                Parsing active
              </span>
            </div>
            <div className="p-4">
              <textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder={`Paste the email here...\n\nExample:\nHi Brendan,\n\nWould you be available for a call sometime this week? I'm based in London (GMT) and pretty flexible. Let me know what works for you.\n\nBest,\nSarah`}
                className="w-full min-h-[200px] p-4 rounded-md resize-y text-sm transition-all duration-200"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              />
              
              {emailText && (
                <div className="mt-4 p-4 rounded-md" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px dashed var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Detected Timezone</span>
                    <span className="font-medium" style={{ color: 'var(--accent)' }}>{parsedInfo.tz || 'Not detected'}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px dashed var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Requested Window</span>
                    <span className="font-medium" style={{ color: 'var(--accent)' }}>{parsedInfo.window}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Sender</span>
                    <span className="font-medium" style={{ color: 'var(--accent)' }}>{parsedInfo.sender}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Calendar Panel */}
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                <Calendar className="w-3 h-3" />
                Your Calendar
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{myTimezone.replace('_', ' ')}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <button onClick={prevWeek} className="px-3 py-1.5 rounded-md text-sm transition-colors" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextWeek} className="px-3 py-1.5 rounded-md text-sm transition-colors" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{weekLabel}</span>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={markBusinessHours} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <Zap className="w-3 h-3 inline mr-1" />Mark 9-5 Open
                </button>
                <button onClick={clearAll} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <Trash2 className="w-3 h-3 inline mr-1" />Clear All
                </button>
                <button onClick={selectAllOpen} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <CheckCircle className="w-3 h-3 inline mr-1" />Select All Open
                </button>
              </div>

              {/* Week View Grid */}
              <div className="grid gap-px rounded-md overflow-hidden" style={{ gridTemplateColumns: '50px repeat(7, 1fr)', background: 'var(--border)', border: '1px solid var(--border)' }}>
                {/* Header row */}
                <div className="p-2 text-center text-xs" style={{ background: 'var(--bg-tertiary)' }} />
                {weekDays.map((day, i) => {
                  const date = new Date(currentWeekStart);
                  date.setDate(date.getDate() + i);
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div key={day} className="p-2 text-center text-xs" style={{ background: 'var(--bg-tertiary)', color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {day}<br />{date.getDate()}
                    </div>
                  );
                })}

                {/* Time slots */}
                {Array.from({ length: 13 }, (_, hourIdx) => {
                  const hour = hourIdx + 8;
                  return (
                    <React.Fragment key={hour}>
                      <div className="p-1 text-right pr-2 text-xs flex items-center justify-end" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', height: '28px' }}>
                        {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'pm' : 'am'}
                      </div>
                      {Array.from({ length: 7 }, (_, dayIdx) => {
                        const date = new Date(currentWeekStart);
                        date.setDate(date.getDate() + dayIdx);
                        date.setHours(hour, 0, 0, 0);
                        const slotKey = date.toISOString();
                        const isOpen = openSlots.has(slotKey);
                        const isSelected = selectedSlots.has(slotKey);

                        return (
                          <div
                            key={slotKey}
                            onClick={() => toggleSlot(slotKey)}
                            onContextMenu={(e) => { e.preventDefault(); toggleOpen(slotKey); }}
                            className="cursor-pointer transition-colors"
                            style={{
                              background: isSelected 
                                ? 'var(--accent-glow)' 
                                : isOpen 
                                  ? 'rgba(34, 197, 94, 0.1)' 
                                  : 'var(--bg-secondary)',
                              height: '28px',
                              border: isSelected ? '1px solid var(--accent)' : 'none',
                              margin: isSelected ? '-1px' : '0',
                            }}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: 'rgba(34, 197, 94, 0.3)', border: '1px solid var(--accent)' }} />
                  <span>Open (right-click)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: 'var(--accent)' }} />
                  <span>Selected (click)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                <Globe className="w-3 h-3" />
                Converted Output
              </span>
            </div>
            <div className="p-4">
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Their timezone</label>
              <select
                value={outputTimezone}
                onChange={(e) => setOutputTimezone(e.target.value)}
                className="w-full p-3 rounded-md text-sm mb-4"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>

              <div className="p-4 rounded-md min-h-[150px] text-sm whitespace-pre-wrap" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', lineHeight: 1.8 }}>
                {generateOutput().split(/(\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/gi).map((part, i) => 
                  /\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(part) 
                    ? <span key={i} style={{ color: 'var(--accent)', fontWeight: 500 }}>{part}</span>
                    : part
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={copyOutput} className="flex-1 px-4 py-2.5 rounded-md text-sm transition-colors flex items-center justify-center gap-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div 
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 z-50 ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
        style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
      >
        Copied to clipboard!
      </div>
    </div>
  );
}

export default App;
