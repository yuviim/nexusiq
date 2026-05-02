import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexusiq_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default client
