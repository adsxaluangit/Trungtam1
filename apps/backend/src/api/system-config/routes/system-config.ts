export default {
  routes: [
    {
      method: 'GET',
      path: '/system-config/ai-config',
      handler: 'system-config.getAiConfig',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/system-config/ai-config',
      handler: 'system-config.setAiConfig',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/system-config/test-ai-config',
      handler: 'system-config.testAiConfig',
      config: { auth: false },
    },
    // Backward compatibility routes
    {
      method: 'GET',
      path: '/system-config/gemini-key',
      handler: 'system-config.getGeminiKey',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/system-config/gemini-key',
      handler: 'system-config.setGeminiKey',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/system-config/test-gemini-key',
      handler: 'system-config.testGeminiKey',
      config: { auth: false },
    },
  ],
};
