const SAFE_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

function isSafeExternalUrl(url) {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol);
  } catch (_) {
    return false;
  }
}

module.exports = { isSafeExternalUrl };
