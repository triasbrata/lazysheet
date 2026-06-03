import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Turnstile } from '@marsidev/react-turnstile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Label } from '#/components/ui/label'
import { Button } from '#/components/ui/button'
import { createIssue, type FeedbackType } from '#/features/feedback/create-issue'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string

export interface FeedbackDialogProps {
  trigger: React.ReactNode
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!title.trim() || description.trim().length < 10) {
      toast.error(t('feedback.validationError'))
      return
    }

    if (!captchaToken) {
      toast.error(t('feedback.captchaError'))
      return
    }

    setSubmitting(true)
    try {
      const r = await createIssue({
        data: {
          type,
          title: title.trim(),
          description: description.trim(),
          contact: contact.trim() || undefined,
          company,
          turnstileToken: captchaToken,
        },
      })

      if (r.number > 0) {
        toast.success(t('feedback.successToast', { number: r.number }))
        setTitle('')
        setDescription('')
        setContact('')
        setCompany('')
        setType('feature')
        setCaptchaToken(null)
        setOpen(false)
      } else {
        // honeypot silent drop
        setOpen(false)
      }
    } catch {
      toast.error(t('feedback.errorToast'))
      setCaptchaToken(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('feedback.typeLabel')}</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="bug">{t('feedback.typeBug')}</option>
              <option value="feature">{t('feedback.typeFeature')}</option>
              <option value="other">{t('feedback.typeOther')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-title">{t('feedback.titleLabel')}</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t('feedback.titlePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-description">{t('feedback.descLabel')}</Label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder={t('feedback.descPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-contact">{t('feedback.contactLabel')}</Label>
            <Input
              id="feedback-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('feedback.contactPlaceholder')}
            />
          </div>

          {/* Honeypot — hidden from real users */}
          <input
            name="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="sr-only"
          />

          {SITE_KEY ? (
            <Turnstile
              siteKey={SITE_KEY}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('feedback.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
