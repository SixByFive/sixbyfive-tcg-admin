import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminProduct, AdminProductInput } from '@tcg-admin/types'

const EMPTY_FORM: AdminProductInput = {
  title: '', description: '', imageUrl: '', price: 0,
  currency: 'GBP', quantity: 1, status: 'active',
  fulfilmentType: 'INTERNAL', fulfilmentProvider: '', fulfilmentExternalId: '',
}

export function ProductsPage(): JSX.Element {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<AdminProductInput>(EMPTY_FORM)
  const [creating, setCreating]     = useState(false)
  const [createErr, setCreateErr]   = useState('')

  // Edit
  const [editing, setEditing]     = useState<AdminProduct | null>(null)
  const [editForm, setEditForm]   = useState<AdminProductInput>(EMPTY_FORM)
  const [updating, setUpdating]   = useState(false)
  const [updateErr, setUpdateErr] = useState('')

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getProductListings({ page })
      .then(({ products, total }) => { setProducts(products); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const setF = (k: keyof AdminProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const setEF = (k: keyof AdminProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true); setCreateErr('')
    try {
      await adminApi.createProductListing({
        ...form,
        description: form.description || null,
        imageUrl:    form.imageUrl    || null,
        fulfilmentType:     form.fulfilmentType     || null,
        fulfilmentProvider: form.fulfilmentProvider || null,
        fulfilmentExternalId: form.fulfilmentExternalId || null,
      })
      setForm(EMPTY_FORM); setShowCreate(false); load()
    } catch (e) { setCreateErr((e as Error).message) }
    finally { setCreating(false) }
  }

  const startEdit = (p: AdminProduct) => {
    setEditing(p)
    setEditForm({
      title: p.title, description: p.description || '', imageUrl: p.imageUrl || '',
      price: p.price, currency: p.currency, quantity: p.quantity, status: p.status,
      fulfilmentType: p.fulfilmentType || 'INTERNAL',
      fulfilmentProvider: p.fulfilmentProvider || '',
      fulfilmentExternalId: p.fulfilmentExternalId || '',
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setUpdating(true); setUpdateErr('')
    try {
      await adminApi.updateProductListing(editing.id, {
        ...editForm,
        description: editForm.description || null,
        imageUrl:    editForm.imageUrl    || null,
        fulfilmentType:     editForm.fulfilmentType     || null,
        fulfilmentProvider: editForm.fulfilmentProvider || null,
        fulfilmentExternalId: editForm.fulfilmentExternalId || null,
      })
      setEditing(null); load()
    } catch (e) { setUpdateErr((e as Error).message) }
    finally { setUpdating(false) }
  }

  const handleDelete = async (p: AdminProduct) => {
    if (!confirm(`Remove product "${p.title}" (${p.id})? It will be marked as removed.`)) return
    setDeleting(p.id)
    try { await adminApi.deleteProductListing(p.id); load() }
    catch (e) { setError((e as Error).message) }
    finally { setDeleting(null) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  )

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">Manage product listings (hoodies, prints, etc.)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} disabled={loading} className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50">Refresh</button>
          <button onClick={() => setShowCreate(v => !v)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            {showCreate ? 'Cancel' : '+ New product'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">New product listing</h2>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Title *">
              <input required value={form.title} onChange={setF('title')} placeholder="SixByFive Hoodie" className={inputCls} />
            </FieldRow>
            <FieldRow label="Price (£) *">
              <input type="number" step="0.01" min="0" required value={form.price} onChange={setF('price')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Currency">
              <input value={form.currency ?? ''} onChange={setF('currency')} placeholder="GBP" className={inputCls} />
            </FieldRow>
            <FieldRow label="Quantity">
              <input type="number" min="1" value={form.quantity} onChange={setF('quantity')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Fulfilment type">
              <select value={form.fulfilmentType ?? ''} onChange={setF('fulfilmentType')} className={inputCls}>
                <option value="INTERNAL">Internal</option>
                <option value="POD">Print-on-demand (POD)</option>
              </select>
            </FieldRow>
            <FieldRow label="Fulfilment provider">
              <input value={form.fulfilmentProvider ?? ''} onChange={setF('fulfilmentProvider')} placeholder="Inkthreadables" className={inputCls} />
            </FieldRow>
            <FieldRow label="External ID">
              <input value={form.fulfilmentExternalId ?? ''} onChange={setF('fulfilmentExternalId')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Image URL">
              <input value={form.imageUrl ?? ''} onChange={setF('imageUrl')} placeholder="https://…" className={inputCls} />
            </FieldRow>
          </div>
          <FieldRow label="Description">
            <textarea rows={2} value={form.description ?? ''} onChange={setF('description')} className={inputCls} />
          </FieldRow>
          {createErr && <p className="text-sm text-destructive">{createErr}</p>}
          <button type="submit" disabled={creating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create product'}
          </button>
        </form>
      )}

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleUpdate} className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Edit: {editing.title}</h2>
            <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Title *">
              <input required value={editForm.title} onChange={setEF('title')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Price (£) *">
              <input type="number" step="0.01" min="0" required value={editForm.price} onChange={setEF('price')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Currency">
              <input value={editForm.currency ?? ''} onChange={setEF('currency')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Quantity">
              <input type="number" min="1" value={editForm.quantity} onChange={setEF('quantity')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Fulfilment type">
              <select value={editForm.fulfilmentType ?? ''} onChange={setEF('fulfilmentType')} className={inputCls}>
                <option value="INTERNAL">Internal</option>
                <option value="POD">Print-on-demand (POD)</option>
              </select>
            </FieldRow>
            <FieldRow label="Fulfilment provider">
              <input value={editForm.fulfilmentProvider ?? ''} onChange={setEF('fulfilmentProvider')} className={inputCls} />
            </FieldRow>
            <FieldRow label="External ID">
              <input value={editForm.fulfilmentExternalId ?? ''} onChange={setEF('fulfilmentExternalId')} className={inputCls} />
            </FieldRow>
            <FieldRow label="Image URL">
              <input value={editForm.imageUrl ?? ''} onChange={setEF('imageUrl')} className={inputCls} />
            </FieldRow>
          </div>
          <FieldRow label="Description">
            <textarea rows={2} value={editForm.description ?? ''} onChange={setEF('description')} className={inputCls} />
          </FieldRow>
          {updateErr && <p className="text-sm text-destructive">{updateErr}</p>}
          <button type="submit" disabled={updating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {updating ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}

      {/* Products table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Title', 'Price', 'Qty', 'Status', 'Fulfilment', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No product listings yet.</td></tr>
            ) : products.map(p => (
              <tr key={p.id} className={`border-b border-border/40 hover:bg-accent/30 ${editing?.id === p.id ? 'bg-primary/5' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{p.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.id.slice(0,8)}…</p>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {p.currency ?? 'GBP'} {typeof p.price === 'number' ? p.price.toFixed(2) : p.price ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.quantity ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-accent text-muted-foreground'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <p>{p.fulfilmentType ?? '—'}</p>
                  {p.fulfilmentProvider && <p className="text-xs opacity-60">{p.fulfilmentProvider}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {p.createdAt ? formatDate(p.createdAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => editing?.id === p.id ? setEditing(null) : startEdit(p)}
                      className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      {editing?.id === p.id ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      disabled={deleting === p.id}
                      onClick={() => handleDelete(p)}
                      className="rounded px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {deleting === p.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
        </div>
      </div>
    </div>
  )
}
