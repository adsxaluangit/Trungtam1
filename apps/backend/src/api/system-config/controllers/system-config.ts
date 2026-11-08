export default {
  async getAiConfig(ctx: any) {
    try {
      const knex = (strapi as any).db.connection;
      const hasTable = await knex.schema.hasTable('system_settings');

      let provider = 'gemini';
      let geminiKey = '';
      let nanoBananaKey = '';
      let nanoBananaBaseUrl = 'https://api.nanobananaapi.ai/api/v1';
      let nanoBananaModel = 'NanoBanana 2';

      if (hasTable) {
        const rows = await knex('system_settings').whereIn('key', [
          'ai_provider',
          'gemini_api_key',
          'nano_banana_api_key',
          'nano_banana_base_url',
          'nano_banana_model'
        ]);

        const map: Record<string, string> = {};
        rows.forEach((r: any) => { map[r.key] = r.value; });

        if (map.ai_provider) provider = map.ai_provider;
        if (map.gemini_api_key) geminiKey = map.gemini_api_key;
        if (map.nano_banana_api_key) nanoBananaKey = map.nano_banana_api_key;
        if (map.nano_banana_base_url) nanoBananaBaseUrl = map.nano_banana_base_url;
        if (map.nano_banana_model) nanoBananaModel = map.nano_banana_model;
      }

      if (!geminiKey && process.env.GEMINI_API_KEY) {
        geminiKey = process.env.GEMINI_API_KEY.trim();
      }

      const mask = (key: string) => {
        if (!key) return '';
        return key.length > 8 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : '********';
      };

      const isConfigured = provider === 'gemini' ? !!geminiKey : !!nanoBananaKey;

      return {
        provider,
        isConfigured,
        geminiMaskedKey: mask(geminiKey),
        nanoBananaMaskedKey: mask(nanoBananaKey),
        nanoBananaBaseUrl,
        nanoBananaModel,

        // Alias for backward compatibility
        maskedKey: provider === 'gemini' ? mask(geminiKey) : mask(nanoBananaKey)
      };
    } catch (err: any) {
      console.error('[getAiConfig] error:', err);
      return ctx.internalServerError(err.message || 'Error fetching AI Config');
    }
  },

  // Alias endpoint
  async getGeminiKey(ctx: any) {
    return this.getAiConfig(ctx);
  },

  async setAiConfig(ctx: any) {
    try {
      const {
        provider = 'gemini',
        geminiApiKey,
        nanoBananaApiKey,
        nanoBananaBaseUrl = 'https://api.nanobananaapi.ai/api/v1',
        nanoBananaModel = 'NanoBanana 2'
      } = ctx.request.body;

      const knex = (strapi as any).db.connection;
      const hasTable = await knex.schema.hasTable('system_settings');

      if (!hasTable) {
        await knex.schema.createTable('system_settings', (table: any) => {
          table.string('key').primary();
          table.text('value');
          table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
      }

      const upsert = async (key: string, val: string) => {
        if (val === undefined || val === null) return;
        const cleanVal = String(val).trim();
        const existing = await knex('system_settings').where('key', key).first();
        if (existing) {
          await knex('system_settings').where('key', key).update({ value: cleanVal, updated_at: new Date() });
        } else {
          await knex('system_settings').insert({ key, value: cleanVal, updated_at: new Date() });
        }
      };

      await upsert('ai_provider', provider);
      if (geminiApiKey !== undefined) await upsert('gemini_api_key', geminiApiKey);
      if (nanoBananaApiKey !== undefined) await upsert('nano_banana_api_key', nanoBananaApiKey);
      if (nanoBananaBaseUrl !== undefined) await upsert('nano_banana_base_url', nanoBananaBaseUrl);
      if (nanoBananaModel !== undefined) await upsert('nano_banana_model', nanoBananaModel);

      return {
        success: true,
        message: 'Lưu cấu hình AI thành công!',
        ...(await this.getAiConfig(ctx))
      };
    } catch (err: any) {
      console.error('[setAiConfig] error:', err);
      return ctx.internalServerError(err.message || 'Error saving AI Config');
    }
  },

  // Alias endpoint
  async setGeminiKey(ctx: any) {
    if (ctx.request.body.apiKey) {
      ctx.request.body.geminiApiKey = ctx.request.body.apiKey;
    }
    return this.setAiConfig(ctx);
  },

  async testAiConfig(ctx: any) {
    try {
      const body = ctx.request.body || {};
      const knex = (strapi as any).db.connection;
      const hasTable = await knex.schema.hasTable('system_settings');

      let provider = body.provider;
      let geminiKey = body.geminiApiKey;
      let nanoBananaKey = body.nanoBananaApiKey;
      let nanoBananaBaseUrl = body.nanoBananaBaseUrl;
      let nanoBananaModel = body.nanoBananaModel;

      if (hasTable) {
        const rows = await knex('system_settings').whereIn('key', [
          'ai_provider',
          'gemini_api_key',
          'nano_banana_api_key',
          'nano_banana_base_url',
          'nano_banana_model'
        ]);

        const map: Record<string, string> = {};
        rows.forEach((r: any) => { map[r.key] = r.value; });

        if (!provider) provider = map.ai_provider || 'gemini';
        if (!geminiKey) geminiKey = map.gemini_api_key || process.env.GEMINI_API_KEY || '';
        if (!nanoBananaKey) nanoBananaKey = map.nano_banana_api_key || '';
        if (!nanoBananaBaseUrl) nanoBananaBaseUrl = map.nano_banana_base_url || 'https://api.nanobananaapi.ai/api/v1';
        if (!nanoBananaModel) nanoBananaModel = map.nano_banana_model || 'NanoBanana 2';
      }

      if (provider === 'nano_banana') {
        if (!nanoBananaKey || nanoBananaKey.trim() === '') {
          return ctx.badRequest('Chưa có API Key Nano Banana để kiểm tra.');
        }

        const cleanBaseUrl = (nanoBananaBaseUrl || 'https://api.nanobananaapi.ai/api/v1').replace(/\/+$/, '');
        const targetUrl = `${cleanBaseUrl}/common/credit`;

        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${nanoBananaKey.trim()}`
          }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || (data.code && data.code !== 200)) {
          const errMsg = data.msg || data.message || `HTTP ${res.status}`;
          return {
            success: false,
            message: `Kết nối NanoBananaAPI.ai thất bại (${errMsg})`
          };
        }

        const credits = data.data !== undefined ? data.data : 'N/A';
        return {
          success: true,
          message: `Kết nối NanoBananaAPI.ai thành công! Số dư Credit tài khoản còn: ${credits} credits`,
          reply: `Credits: ${credits}`
        };
      } else {
        // Google Gemini
        if (!geminiKey || geminiKey.trim() === '') {
          return ctx.badRequest('Chưa có Gemini API Key để kiểm tra.');
        }

        const { GoogleGenAI } = await import('@google/genai');
        const aiClient = new GoogleGenAI({
          apiKey: geminiKey.trim(),
        });

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'Test connection. Please reply "OK".',
        });

        const text = response.text || '';
        return {
          success: true,
          message: 'Kết nối Google Gemini API thành công!',
          reply: text.trim()
        };
      }
    } catch (err: any) {
      console.error('[testAiConfig] error:', err);
      return {
        success: false,
        message: 'Kết nối thất bại: ' + (err.message || String(err))
      };
    }
  },

  // Alias endpoint
  async testGeminiKey(ctx: any) {
    return this.testAiConfig(ctx);
  }
};
