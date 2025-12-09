import { useState } from 'react'
import { StickyNote, Plus, Search, MoreHorizontal } from 'lucide-react'

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export function Notes() {
  const [notes] = useState<Note[]>([
    {
      id: '1',
      title: 'Meeting Notes - Sprint Planning',
      content: 'Discussed upcoming features and priorities for Q1...',
      createdAt: '2024-01-15',
      updatedAt: '2 hours ago'
    },
    {
      id: '2',
      title: 'Bug Investigation',
      content: 'Found the root cause of the authentication issue...',
      createdAt: '2024-01-14',
      updatedAt: 'Yesterday'
    },
    {
      id: '3',
      title: 'Architecture Decision',
      content: 'Decided to use SQLite for local storage instead of IndexedDB...',
      createdAt: '2024-01-12',
      updatedAt: '3 days ago'
    }
  ])

  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="text-muted-foreground">Quick notes and work journal</p>
        </div>
        
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
          <Plus size={16} />
          New Note
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <StickyNote size={32} className="text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">No Notes Found</h2>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'Try a different search term' : 'Create your first note to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="font-medium text-foreground line-clamp-1">{note.title}</h3>
                <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                  <MoreHorizontal size={16} />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{note.content}</p>
              <p className="text-xs text-muted-foreground">{note.updatedAt}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
