export function renderMarkdown(text) {
  if (!text) return ''

  const lines = text.split('\n')
  const output = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const clean = line.trim().replace(/^\*\s*/, '')

    // Table detection
    if (clean.startsWith('|')) {
      const tableLines = []
      let j = i
      while (j < lines.length) {
        const l = lines[j].trim().replace(/^\*\s*/, '')
        if (l.startsWith('|')) { tableLines.push(l); j++ }
        else if (l === '') { j++; break }
        else break
      }
      if (tableLines.length >= 2) {
        const headers = tableLines[0].split('|').filter(c => c.trim() !== '')
        const rows = tableLines.slice(2).map(r =>
          r.split('|').filter(c => c.trim() !== '')
        )
        let table = '<table><thead><tr>'
        table += headers.map(h => `<th>${h.trim()}</th>`).join('')
        table += '</tr></thead><tbody>'
        rows.forEach(row => {
          table += '<tr>' + row.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
        })
        table += '</tbody></table>'
        output.push(table)
        i = j
        continue
      }
    }

    // Escape HTML only for non-table lines
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    output.push(escaped)
    i++
  }

  return output.join('\n')
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^\s*[-*+]\s+(?!\|)(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/&gt;\s*\*(.+?)\*$/gm, '<blockquote><em>$1</em></blockquote>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^(?!<[hultb]|<li|<hr|<blockquote)(.+)$/gm, '<p>$1</p>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/<p><\/p>/g, '')
    .trim()
}