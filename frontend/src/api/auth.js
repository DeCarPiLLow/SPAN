import api from './axios'
import axios from 'axios'

export const initiateLogin = (codeChallenge, codeVerifier) =>
  api.post('/auth/login', { code_challenge: codeChallenge, code_verifier: codeVerifier })

export const exchangeCallback = (code, state) =>
  api.post('/auth/callback', { code, state })

export const getMe = () => api.get('/auth/me')

export const logout = () => api.post('/auth/logout')
