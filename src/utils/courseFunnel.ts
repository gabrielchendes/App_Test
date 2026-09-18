import { Course } from '../types/lms';

export const MODAL_HTML_MARKER = '<!--__PWA_MODAL_HTML__-->';
export const PREVIEW_HTML_MARKER = '<!--__PWA_HTML_APP__-->';

/**
 * Normaliza os dados do curso para recuperar o modal HTML e a página de preview HTML
 * armazenados no banco de dados.
 */
export function parseCourseHtmlFunnel(rawCourse: Partial<Course> | null | undefined): Partial<Course> {
  if (!rawCourse) return {};

  const firstBenefit = rawCourse.benefits?.[0];
  const hasModalHtmlMarker = typeof firstBenefit === 'string' && firstBenefit.startsWith(MODAL_HTML_MARKER);
  const isModalHtml = rawCourse.modal_type === 'html' || hasModalHtmlMarker;

  let modalHtml = rawCourse.modal_html || '';
  let cleanBenefits = Array.isArray(rawCourse.benefits) ? [...rawCourse.benefits] : [];

  if (hasModalHtmlMarker) {
    modalHtml = firstBenefit
      .replace(`${MODAL_HTML_MARKER}\n`, '')
      .replace(MODAL_HTML_MARKER, '')
      .trim();
    cleanBenefits = cleanBenefits.slice(1);
  }

  // Preview HTML
  const rawPreviewText = rawCourse.preview_rich_text || '';
  const hasPreviewHtmlMarker = rawPreviewText.startsWith(PREVIEW_HTML_MARKER) || rawPreviewText.includes(PREVIEW_HTML_MARKER);
  const looksLikeHtml = /^\s*<(!DOCTYPE|html|div|main|section|body|header)/i.test(rawPreviewText);

  const isPreviewHtml = 
    rawCourse.preview_type === 'html' || 
    (rawCourse.preview_type === 'text' && (hasPreviewHtmlMarker || looksLikeHtml)) ||
    hasPreviewHtmlMarker;

  let cleanPreviewRichText = rawPreviewText;
  if (hasPreviewHtmlMarker) {
    cleanPreviewRichText = rawPreviewText
      .replace(`${PREVIEW_HTML_MARKER}\n`, '')
      .replace(PREVIEW_HTML_MARKER, '')
      .trim();
  }

  return {
    ...rawCourse,
    modal_type: isModalHtml ? 'html' : 'standard',
    modal_html: modalHtml,
    benefits: isModalHtml ? cleanBenefits.filter(b => !b.startsWith(MODAL_HTML_MARKER)) : cleanBenefits,
    preview_type: isPreviewHtml ? 'html' : (rawCourse.preview_type || 'video'),
    preview_rich_text: cleanPreviewRichText
  };
}

/**
 * Serializa os campos HTML do funil de vendas antes de enviar ao Supabase.
 */
export function serializeCourseHtmlFunnel(course: Partial<Course>) {
  const isModalHtml = course.modal_type === 'html';
  const cleanModalHtml = (course.modal_html || '').trim();

  const finalBenefits = isModalHtml
    ? [`${MODAL_HTML_MARKER}\n${cleanModalHtml}`]
    : (course.benefits || []).filter(b => b.trim() !== '' && !b.startsWith(MODAL_HTML_MARKER));

  const isPreviewHtml = course.preview_type === 'html';
  const cleanPreviewHtml = (course.preview_rich_text || '').trim();

  const finalPreviewType = isPreviewHtml ? 'text' : (course.preview_type || 'video');
  const finalPreviewRichText = isPreviewHtml
    ? `${PREVIEW_HTML_MARKER}\n${cleanPreviewHtml}`
    : (course.preview_rich_text || '');

  return {
    finalBenefits,
    finalPreviewType,
    finalPreviewRichText
  };
}
