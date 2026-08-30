/** Ask the local Vite dev server to launch VisProm.app (macOS only). */
export async function launchVispromMacApp(bounds = null) {
  try {
    const response = await fetch('/__open-visprom-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bounds || {}),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Launch failed (${response.status})`);
    }
    return true;
  } catch (error) {
    console.warn('[VisProm] Could not launch local app:', error);
    return false;
  }
}

export const VISPROM_ONLINE_URL = '/visprom/index.html';
export const VISPROM_GITHUB_URL = 'https://github.com/MIA-PS-Vis/UPSaclay-VisProm';

/** Screen coordinates for an element (matches where a desktop window should land). */
export function getScreenBounds(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return null;

  return {
    x: Math.round(rect.left + window.screenX),
    y: Math.round(rect.top + window.screenY),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
