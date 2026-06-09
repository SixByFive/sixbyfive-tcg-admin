import { useState } from 'react'
import { adminApi } from '@/lib/api'

export function NotificationsPage(): JSX.Element {
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [type, setType]       = useState('admin_broadcast')
  const [iconUrl, setIconUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true); setError(''); setSuccess(false)
    try {
      await adminApi.sendBroadcastNotification({
        title:   title.trim(),
        body:    body.trim(),
        type:    type.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
      })
      setSuccess(true)
      setTitle(''); setBody(''); setIconUrl(''); setLinkUrl('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Broadcast Notification</h1>
      <p className="mb-6 text-sm text-muted-foreground">Send a notification to all users on the platform.</p>

      {success && (
        <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          ✓ Notification sent successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title <span className="text-destructive">*</span></label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Platform maintenance tonight"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body <span className="text-destructive">*</span></label>
          <textarea
            required
            rows={3}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Message body sent to all users…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
          <input
            value={type}
            onChange={e => setType(e.target.value)}
            placeholder="admin_broadcast"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Used for filtering in the app. Default: admin_broadcast</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icon URL (optional)</label>
            <input
              value={iconUrl}
              onChange={e => setIconUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Link URL (optional)</label>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
        >
          {sending ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
    </div>
  )
}
