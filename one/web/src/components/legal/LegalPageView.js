import Link from 'next/link';
import StudioHeader, { PageEyebrow } from '@/components/site/StudioHeader';
import { localizedPathFor } from '@/lib/client/localeSwitch';
import {
  LEGAL_FOOTER_LINKS,
  LEGAL_PAGES,
  LEGAL_VERSIONS,
  getLegalCopy,
  getLegalSections,
} from '@/lib/legalCopy';
import LegalRichText from './LegalRichText';

/**
 * One renderer for the four compliance pages, copy resolved from
 * `messages/<locale>/legal.json`.
 *
 * Structure (which page, how many sections, the version stamp) stays in code;
 * only the strings are translated. Section and paragraph ids are read in
 * numeric order, so `s1…s6` / `p1…p4` cannot reshuffle between locales, and a
 * locale that gains a clause fails the CI key-parity gate rather than rendering
 * a short document.
 *
 * The container classes are the ones the hand-written pages already used, kept
 * verbatim: this is a copy-extraction, not a redesign.
 */
export default function LegalPageView({ page, locale }) {
  const copy = getLegalCopy(locale);
  const content = copy?.[page];
  if (!content) return null;

  const pageCopy = {
    headerSubtitle: content.headerSubtitle,
    eyebrow: content.eyebrow,
    heading: content.heading,
    intro: content.intro,
  };
  const sections = getLegalSections(locale, page);
  const footerLinks = LEGAL_FOOTER_LINKS.filter((entry) => entry.page !== page);

  return (
    <div className="min-h-screen bg-canvas text-white flex flex-col">
      <StudioHeader
        locale={locale}
        title={copy.shared.headerTitle}
        subtitle={pageCopy.headerSubtitle}
      />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/[0.08] bg-surface/80 p-6 sm:p-10 shadow-2xl backdrop-blur-md">
          <div className="border-b border-white/[0.08] pb-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <PageEyebrow>{pageCopy.eyebrow}</PageEyebrow>
              <span className="text-xs text-gray-500 font-mono">{LEGAL_VERSIONS[page]}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              <LegalRichText value={pageCopy.heading} />
            </h1>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              <LegalRichText value={pageCopy.intro} />
            </p>
          </div>

          <section className="space-y-8 text-sm leading-relaxed text-gray-300">
            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border border-white/[0.06] bg-base/60 p-5">
                <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-400" />
                  <LegalRichText value={section.title} />
                </h2>
                {section.paragraphs.length === 1 ? (
                  <p className="text-gray-400">
                    <LegalRichText value={section.paragraphs[0].text} />
                  </p>
                ) : (
                  <div className="space-y-3 text-gray-400">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph.id}>
                        <LegalRichText value={paragraph.text} />
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <p className="mt-8 rounded-xl border border-white/[0.06] bg-base/60 p-4 text-xs leading-relaxed text-gray-500">
            <LegalRichText value={copy.shared.disclaimer} />
          </p>

          {/* 底部法律导航联动 */}
          <div className="mt-10 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
            <div><LegalRichText value={copy.shared.copyright} /></div>
            <div className="flex items-center gap-4">
              {footerLinks.map((entry) => (
                <Link
                  key={entry.page}
                  href={localizedPathFor(`/${LEGAL_PAGES[entry.page]}`, locale) || `/${LEGAL_PAGES[entry.page]}`}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {copy.shared.links[entry.linkKey]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
