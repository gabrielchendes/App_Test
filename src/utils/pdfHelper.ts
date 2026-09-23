/**
 * Helper to normalize, validate and generate embeddable URLs for PDF viewing.
 */

export function normalizePdfUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();

  // Auto-heal known path issues or missing prefixes in Supabase Storage
  if (url.includes('/Ebooks/B3-Male-Mind-Confidential.pdf')) {
    url = url.replace('/Ebooks/B3-Male-Mind-Confidential.pdf', '/Ebooks/1.B3-Male-Mind-Confidential.pdf');
  }

  // Handle Google Drive view / edit / sharing links -> convert to /preview for clean embedding
  if (url.includes('drive.google.com')) {
    let fileId = '';
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    const match3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) fileId = match1[1];
    else if (match2) fileId = match2[1];
    else if (match3) fileId = match3[1];

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }

  return url;
}

export function getPdfEmbedSources(rawUrl: string, reloadKey = 0) {
  const cleanUrl = normalizePdfUrl(rawUrl);
  if (!cleanUrl) {
    return { isGoogleDrive: false, googleDocsUrl: '', directUrl: '', cleanUrl: '' };
  }

  const isGoogleDrive = cleanUrl.includes('drive.google.com');

  if (isGoogleDrive) {
    return {
      isGoogleDrive: true,
      googleDocsUrl: cleanUrl,
      directUrl: cleanUrl,
      cleanUrl
    };
  }

  const reloadParam = reloadKey > 0 ? `&_t=${reloadKey}` : '';
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(cleanUrl)}&embedded=true${reloadParam}`;
  const directUrl = `${cleanUrl}${cleanUrl.includes('#') ? '' : '#toolbar=1&navpanes=0'}`;

  return {
    isGoogleDrive: false,
    googleDocsUrl,
    directUrl,
    cleanUrl
  };
}
