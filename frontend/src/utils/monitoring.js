const MONITORING_KEY = 'monitoringMap';

export const getMonitoringMap = () => {
  try {
    const raw = localStorage.getItem(MONITORING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
};

export const saveMonitoringMap = (map) => {
  try {
    localStorage.setItem(MONITORING_KEY, JSON.stringify(map || {}));
  } catch (err) {
    // ignore
  }
};
