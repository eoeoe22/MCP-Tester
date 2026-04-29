export type TokenProvider = "claude" | "gemini"

export type TokenEnv = {
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
}

export type ModelInfo = {
  provider: TokenProvider
  modelId: string
  maxTokens: number
}

export type ModelList = {
  models: ModelInfo[]
  defaultModelId: string
}

export type CountResult = {
  tokens: number
  safe: boolean
  remaining: number
}

const CLAUDE_MAX_FALLBACK = 200000
const GEMINI_MAX = 1048576

export async function listModels(provider: TokenProvider, env: TokenEnv): Promise<ModelList> {
  if (provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    })
    if (!res.ok) throw new Error(`Claude models ${res.status}: ${await res.text()}`)
    const data = await res.json() as { data: Array<{ id: string; max_input_tokens?: number }> }
    const models: ModelInfo[] = (data.data || []).map(m => ({
      provider,
      modelId: m.id,
      maxTokens: m.max_input_tokens ?? CLAUDE_MAX_FALLBACK
    }))
    if (!models.length) throw new Error('No Claude models returned')
    return { models, defaultModelId: models[0].modelId }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`
  )
  if (!res.ok) throw new Error(`Gemini models ${res.status}: ${await res.text()}`)
  const data = await res.json() as { models: Array<{ name: string }> }
  const models: ModelInfo[] = (data.models || [])
    .filter(m => (m.name || '').startsWith('models/gemini-'))
    .map(m => ({
      provider,
      modelId: m.name.replace(/^models\//, ''),
      maxTokens: GEMINI_MAX
    }))
  if (!models.length) throw new Error('No Gemini models returned')
  const isFlashNonLite = (id: string) => id.includes('flash') && !id.includes('lite')
  const preferred =
    models.find(m => m.modelId.startsWith('gemini-3-flash') && !m.modelId.includes('lite')) ??
    models.find(m => isFlashNonLite(m.modelId))
  return { models, defaultModelId: (preferred ?? models[0]).modelId }
}

export async function loadModel(provider: TokenProvider, env: TokenEnv): Promise<ModelInfo> {
  const list = await listModels(provider, env)
  const found = list.models.find(m => m.modelId === list.defaultModelId)
  if (!found) throw new Error(`Default model ${list.defaultModelId} not in list`)
  return found
}

export async function countTokens(
  provider: TokenProvider,
  text: string,
  env: TokenEnv,
  model?: ModelInfo
): Promise<CountResult> {
  const info = model ?? await loadModel(provider, env)
  let tokens: number

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: info.modelId,
        messages: [{ role: "user", content: text }]
      })
    })
    if (!res.ok) throw new Error(`Claude count_tokens ${res.status}: ${await res.text()}`)
    const data = await res.json() as { input_tokens: number }
    tokens = data.input_tokens
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${info.modelId}:countTokens?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
      }
    )
    if (!res.ok) throw new Error(`Gemini countTokens ${res.status}: ${await res.text()}`)
    const data = await res.json() as { totalTokens: number }
    tokens = data.totalTokens
  }

  const remaining = info.maxTokens - tokens
  return { tokens, safe: remaining >= 0, remaining }
}
