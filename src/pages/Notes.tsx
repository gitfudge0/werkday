import { useState, useEffect, useCallback } from 'react'
import { 
  StickyNote, 
  Plus, 
  Trash2, 
  X,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react'
import { formatDistanceToNow } from '../lib/utils'

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Editor state
  const [isEditing, setIsEditing] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Fetch all notes
  const fetchNotes = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('http://localhost:3001/api/notes')
      
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }
      
      const data = await response.json()
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Start creating a new note
  const handleNewNote = () => {
    setEditingNote(null)
    setTitle('')
    setContent('')
    setIsEditing(true)
  }

  // Start editing an existing note
  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setTitle(note.title)
    setContent(note.content)
    setIsEditing(true)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingNote(null)
    setTitle('')
    setContent('')
  }

  // Save note (create or update)
  const handleSaveNote = async () => {
    if (!title.trim() && !content.trim()) {
      setError('Note must have a title or content')
      return
    }

    try {
      setError(null)
      setIsSaving(true)

      const noteData = {
        id: editingNote?.id,
        title: title.trim() || 'Untitled',
        content: content.trim(),
        createdAt: editingNote?.createdAt,
        tags: editingNote?.tags || []
      }

      const response = await fetch('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      })

      if (!response.ok) {
        throw new Error('Failed to save note')
      }

      // Refresh notes list
      await fetchNotes()
      handleCancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete note
  const handleDeleteNote = async (id: string) => {
    try {
      setError(null)
      
      const response = await fetch(`http://localhost:3001/api/notes/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      // Update local state
      setNotes(notes.filter(n => n.id !== id))
      setDeleteConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }

  // Stats
  const stats = {
    total: notes.length,
    thisWeek: notes.filter(n => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(n.updatedAt) >= weekAgo
    }).length
  }

  // Loading state
  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="flex h-full items-center justify-center">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  // Editor view
  if (isEditing) {
    return (
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {editingNote ? 'Edit Note' : 'New Note'}
            </h1>
            <p className="text-muted-foreground">
              {editingNote ? 'Update your note below' : 'Create a new note'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Editor Form */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>
          <div className="p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              className="min-h-[400px] w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="text-muted-foreground">Quick notes and work journal</p>
        </div>
        
        <button
          onClick={handleNewNote}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          New Note
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <StickyNote size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Notes</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileText size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.thisWeek}</p>
              <p className="text-xs text-muted-foreground">Updated This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold text-foreground">All Notes</h2>
        </div>
        
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <StickyNote size={32} className="mb-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">No notes yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first note to keep track of your work.
            </p>
            <button
              onClick={handleNewNote}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              Create Note
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group flex items-start gap-4 p-4 transition-colors hover:bg-surface-raised/50"
              >
                <div className="mt-1">
                  <StickyNote size={16} className="text-amber-400" />
                </div>
                
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleEditNote(note)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{note.title}</p>
                      {note.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {note.content}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(note.updatedAt)}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {note.tags.slice(0, 3).map(tag => (
                          <span 
                            key={tag}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <div className="flex items-center gap-2">
                  {deleteConfirmId === note.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmId(note.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded-lg p-2 text-muted-foreground transition-all hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
