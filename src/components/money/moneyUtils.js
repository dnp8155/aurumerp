// Indian-style money formatting helpers for the Money dashboard.

export const formatLakh = (amount) => {
  const v = Math.round(amount || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} crore`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} lakh`;
  return `${sign}₹${abs.toLocaleString()}`;
};

export const formatFull = (amount) => `₹${Math.round(amount || 0).toLocaleString()}`;

export const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const sameMonth = (dateStr, year, month) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return d.getFullYear() === year && d.getMonth() === month;
};

export const sameDay = (dateStr, year, month, day) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
};

export const ymd = (dateStr) => (dateStr ? new Date(dateStr).toISOString().slice(0, 10) : "");