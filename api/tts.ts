// api/tts.ts — Vercel Serverless Function
// 代理火山引擎TTS请求，保护access token不暴露到前端

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.VOLCANO_ACCESS_TOKEN;
  const appId = process.env.VOLCANO_APP_ID || process.env.VITE_VOLCANO_APP_ID || '';

  if (!accessToken) {
    return res.status(500).json({ error: 'TTS not configured: missing VOLCANO_ACCESS_TOKEN' });
  }

  // 判断 resource id
  const voiceType = req.body?.req_params?.speaker || '';
  const resourceId = voiceType.startsWith('ICL_')
    ? 'volc.megatts.voiceclone'
    : 'volc.service_type.10029';

  const reqid = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer;${accessToken}`,
        'Resource-Id': resourceId,
        'X-Api-Resource-Id': resourceId,
        'X-Api-App-Key': appId,
        'X-Api-Access-Key': accessToken,
        'X-Api-Request-Id': reqid,
      },
      body: JSON.stringify(req.body),
    });

    // V3 返回 chunked NDJSON，透传原始文本
    const text = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/x-ndjson').send(text);
  } catch (error) {
    console.error('[TTS Proxy] Error:', error);
    res.status(500).json({ error: 'TTS proxy failed' });
  }
}
