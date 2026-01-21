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
