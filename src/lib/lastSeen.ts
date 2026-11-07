/**
 * Real-time "Last Seen" and Online status helper for AgentPay AI
 * Supports both Client & Provider across Specialist Chat, Provider Workspace, and Modals.
 */

export function formatLastSeen(dateStr?: string | number | null): string {
  if (!dateStr) return 'Active recently';
  const d = new Date(dateStr);
  const timeMs = d.getTime();
  if (isNaN(timeMs)) return 'Active recently';

  const now = Date.now();
  const diffSec = Math.floor((now - timeMs) / 1000);

  if (diffSec < 90) {
    return 'Online Now';
  }

  const diffMins = Math.floor(diffSec / 60);
  if (diffMins < 60) {
    return `Last seen ${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `Last seen ${diffHours}h ago`;
  }

  const isToday = new Date().toDateString() === d.toDateString();
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Last seen today at ${timeFormatted}`;
  }

  const yesterday = new Date(Date.now() - 86400000);
  if (yesterday.toDateString() === d.toDateString()) {
    return `Last seen yesterday at ${timeFormatted}`;
  }

  return `Last seen on ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeFormatted}`;
}

export function isUserOnline(dateStr?: string | number | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const timeMs = d.getTime();
  if (isNaN(timeMs)) return false;
  return (Date.now() - timeMs) < 120000; // Active within past 2 minutes
}

