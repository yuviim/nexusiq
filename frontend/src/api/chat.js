import client from './client'

const getAuthHeader = () => {
  const token = localStorage.getItem('nexusiq_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const sendMessage = (query, sessionId) =>
  client.post('/chat', { query, session_id: sessionId }, {
    headers: getAuthHeader()
  })

export const submitHITL = (sessionId, action, editedAnswer = null) =>
  client.post('/hitl', { session_id: sessionId, action, edited_answer: editedAnswer })

export const getHistory = (sessionId) =>
  client.get(`/history/${sessionId}`)

export const newSession = () =>
  client.post('/session/new')

export const getSourceStatus = () =>
  client.get('/sources/status')

export const getConversations = () =>
  client.get('/conversations', { headers: getAuthHeader() })

export const deleteConversation = (sessionId) =>
  client.delete(`/conversations/${sessionId}`, { headers: getAuthHeader() })

export const previewFile = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/upload/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const ingestFile = (file, tableName) => {
  const form = new FormData()
  form.append('file', file)
  form.append('table_name', tableName)
  return client.post('/upload/ingest', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const listTables = () =>
  client.get('/upload/tables')

export const login = (username, password) =>
  client.post('/auth/login', { username, password })

export const logout = (token) =>
  client.post(`/auth/logout?token=${token}`)

export const getMe = (token) =>
  client.get(`/auth/me?token=${token}`)

export const sendMessageStream = (query, sessionId, onToken, onDone, onError) => {
  const token = localStorage.getItem('nexusiq_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  let doneFired = false  // ← add this

  fetch('/api/chat/stream', {
    method:  'POST',
    headers,
    body: JSON.stringify({ query, session_id: sessionId, token }),
  }).then(async res => {
    if (!res.ok) { onError(new Error(`HTTP ${res.status}`)); return }
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text  = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'token') onToken(data.text)
          if (data.type === 'done' && !doneFired) {  // ← add guard
            doneFired = true
            onDone(data)
          }
          if (data.type === 'error') onError(new Error(data.text))
        } catch {}
      }
    }
  }).catch(onError)
}

export const getSuggestions = () =>
  client.get('/suggestions')

export const listDocuments  = ()       => 
    client.get('/documents')
export const deleteDocument = (doc_id) => 
    client.delete(`/documents/${encodeURIComponent(doc_id)}`)