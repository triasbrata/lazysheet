import { useTranslation } from 'react-i18next'
import { FeedbackDialog } from '#/features/feedback/feedback-dialog'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="w-full border-t border-surface-container-high bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 py-8 text-center text-sm text-on-surface-variant sm:flex-row sm:justify-between sm:text-left md:px-16">
        <span>{t('footer.tagline')}</span>
        <div className="flex items-center gap-4">
          <FeedbackDialog
            trigger={
              <button
                type="button"
                className="font-medium text-on-surface-variant no-underline hover:text-primary"
              >
                {t('feedback.trigger')}
              </button>
            }
          />
          <a
            href="https://github.com/triasbrata/lazysheet"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-on-surface-variant no-underline hover:text-primary"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
