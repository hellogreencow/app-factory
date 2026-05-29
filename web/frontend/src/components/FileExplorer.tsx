import { useState } from 'react'
import { File, Folder, ChevronRight, ChevronDown, X } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { cn } from '@/lib/utils'

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
  file?: { lines: number; preview: string; isNew: boolean }
}

function buildTree(files: Array<{ path: string; lines: number; preview: string; isNew: boolean }>): TreeNode[] {
  const root: TreeNode[] = []

  for (const f of files) {
    const parts = f.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isLast = i === parts.length - 1
      const existingIdx = current.findIndex((n) => n.name === name)

      if (existingIdx >= 0) {
        if (isLast) {
          current[existingIdx].file = { lines: f.lines, preview: f.preview, isNew: f.isNew }
        } else {
          current = current[existingIdx].children
        }
      } else {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          isDir: !isLast,
          children: [],
          file: isLast ? { lines: f.lines, preview: f.preview, isNew: f.isNew } : undefined,
        }
        current.push(node)
        if (!isLast) current = node.children
      }
    }
  }

  return root
}

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selected: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1 px-2 py-0.5 text-left hover:bg-surface-raised transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown size={12} className="text-text-tertiary shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-text-tertiary shrink-0" />
          )}
          <Folder size={13} className="text-accent shrink-0" />
          <span className="text-[11px] font-mono text-text-secondary truncate">{node.name}</span>
        </button>
        {open && node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        'w-full flex items-center gap-1 px-2 py-0.5 text-left transition-colors',
        selected === node.path ? 'bg-accent/10 text-accent' : 'hover:bg-surface-raised'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File size={12} className={cn('shrink-0', node.file?.isNew ? 'text-success' : 'text-text-tertiary')} />
      <span className="text-[11px] font-mono text-text-secondary truncate">{node.name}</span>
      {node.file && (
        <span className="text-[9px] text-text-tertiary ml-auto shrink-0">{node.file.lines}L</span>
      )}
    </button>
  )
}

export function FileExplorer() {
  const files = useAppStore((s) => s.files)
  const selectedFile = useAppStore((s) => s.selectedFile)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)

  const tree = buildTree(files)
  const selected = files.find((f) => f.path === selectedFile)

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-text-tertiary">No files yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {selectedFile && selected ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle shrink-0">
            <span className="text-[11px] font-mono text-text-secondary truncate">
              {selectedFile}
            </span>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-text-tertiary hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <pre className="flex-1 overflow-auto px-3 py-2 text-[11px] font-mono text-text-secondary leading-relaxed">
            {selected.preview}
          </pre>
        </div>
      ) : (
        <div className="overflow-y-auto py-1">
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selected={selectedFile}
              onSelect={setSelectedFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
