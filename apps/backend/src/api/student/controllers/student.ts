/**
 * student controller
 */

import { factories } from '@strapi/strapi'


export default factories.createCoreController('api::student.student', ({ strapi }) => ({

  async processPhoto(ctx) {
    try {
      const { originalImage, gender } = ctx.request.body;
      if (!originalImage) {
        return ctx.badRequest("No image provided");
      }

      const knex = (strapi as any).db.connection;
      let provider = 'gemini';
      let geminiKey = process.env.GEMINI_API_KEY || '';
      let nanoBananaKey = '';
      let nanoBananaBaseUrl = 'https://api.nanobanana.com/v1';
      let nanoBananaModel = 'nano-banana-vision';

      try {
        const hasTable = await knex.schema.hasTable('system_settings');
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
          if (map.gemini_api_key && map.gemini_api_key.trim()) geminiKey = map.gemini_api_key.trim();
          if (map.nano_banana_api_key && map.nano_banana_api_key.trim()) nanoBananaKey = map.nano_banana_api_key.trim();
          if (map.nano_banana_base_url && map.nano_banana_base_url.trim()) nanoBananaBaseUrl = map.nano_banana_base_url.trim();
          if (map.nano_banana_model && map.nano_banana_model.trim()) nanoBananaModel = map.nano_banana_model.trim();
        }
      } catch (e) {
        console.error('Error fetching AI config from system_settings:', e);
      }

      if (provider === 'nano_banana') {
        if (!nanoBananaKey) {
          return ctx.badRequest("API Key Nano Banana chưa được cấu hình. Vui lòng vào Quản lý danh mục -> Cấu hình AI.");
        }

        const isFemale = gender === 'Nữ' || gender === 'female' || gender === 'nu';
        const outfitDesc = isFemale
          ? 'mặc áo khoác véc nữ dài tay (women formal suit jacket / blazer) tối màu sang trọng khoác ngoài, bên trong là áo sơ mi trắng có cổ. Trang phục chỉ gồm đúng 2 lớp áo: áo sơ mi trắng bên trong và áo khoác véc bên ngoài. TUYỆT ĐỐI KHÔNG mặc áo gile, KHÔNG mặc áo vest lót không tay, KHÔNG áo gile len hay com-lê 3 mảnh (strictly NO waistcoat, NO gilet, NO sleeveless vest, NO 3-piece suit)'
          : 'mặc áo khoác véc nam dài tay (men formal suit jacket / blazer) tối màu sang trọng khoác ngoài, bên trong là áo sơ mi trắng có cổ và thắt cà vạt. Trang phục chỉ gồm đúng 2 lớp áo: áo sơ mi trắng bên trong và áo khoác véc bên ngoài. TUYỆT ĐỐI KHÔNG mặc áo gile, KHÔNG mặc áo vest lót không tay, KHÔNG áo gile len hay com-lê 3 mảnh (strictly NO waistcoat, NO gilet, NO sleeveless vest, NO 3-piece suit)';

        const promptText = `Hãy biến ảnh chụp thành ảnh kiểu hộ chiếu: BẮT BUỘC giữ nguyên tuyệt đối khuôn mặt và mái tóc giống y hệt ảnh gốc, BẮT BUỘC xóa phông nền cũ và thay bằng nền màu trắng tinh (pure white background), BẮT BUỘC làm sáng vùng khuôn mặt — ánh sáng studio chiếu đều và đủ sáng lên toàn bộ mặt, tông màu da tự nhiên và sáng tươi, mặt sáng rõ nét, định dạng 3x4 cm, ${outfitDesc}.`;

        const cleanBaseUrl = (nanoBananaBaseUrl || 'https://api.nanobananaapi.ai/api/v1').replace(/\/+$/, '');
        const generateUrl = cleanBaseUrl.endsWith('/nanobanana') ? `${cleanBaseUrl}/generate` : `${cleanBaseUrl}/nanobanana/generate`;
        const recordInfoUrl = cleanBaseUrl.endsWith('/nanobanana') ? `${cleanBaseUrl}/record-info` : `${cleanBaseUrl}/nanobanana/record-info`;

        // Upload base64 to Catbox.moe for a temporary public URL
        let publicUrl = originalImage;
        if (originalImage.startsWith('data:image')) {
          const mimeTypeMatch = originalImage.match(/^data:(image\/[a-zA-Z]+);base64,/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
          const ext = mimeType.split('/')[1] || 'png';
          const base64Data = originalImage.replace(/^data:image\/\w+;base64,/, '');

          const fd = new FormData();
          fd.append('reqtype', 'fileupload');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: mimeType });
          fd.append('fileToUpload', blob, `photo.${ext}`);

          const catboxRes = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: fd
          });

          if (!catboxRes.ok) {
             return ctx.badRequest('Không thể upload ảnh trung gian. Vui lòng thử lại.');
          }
          publicUrl = await catboxRes.text();
        }

        // 1. Submit task to NanoBanana API
        const apiRes = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nanoBananaKey}`
          },
          body: JSON.stringify({
            prompt: promptText,
            type: 'IMAGETOIAMGE',
            numImages: 1,
            imageUrls: [publicUrl]
          })
        });

        const initData: any = await apiRes.json().catch(() => ({}));

        if (!apiRes.ok || (initData.code && initData.code !== 200)) {
          const errMsg = initData.msg || initData.message || `HTTP ${apiRes.status}`;
          return ctx.badRequest(`Nano Banana API error: ${errMsg}`);
        }

        const taskId = initData.data?.taskId;
        if (!taskId) {
          return ctx.badRequest("Nano Banana API không trả về taskId.");
        }

        // 2. Poll for completion (up to 30 attempts x 2s = 60s)
        let processedImage = '';
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const statusRes = await fetch(`${recordInfoUrl}?taskId=${taskId}`, {
            headers: {
              'Authorization': `Bearer ${nanoBananaKey}`
            }
          });

          const statusData: any = await statusRes.json().catch(() => ({}));
          const successFlag = statusData.data?.successFlag;

          if (successFlag === 1) {
            processedImage = statusData.data?.response?.resultImageUrl || statusData.data?.response?.resultImage || '';
            break;
          } else if (successFlag === 2 || successFlag === 3) {
            return ctx.badRequest(statusData.data?.errorMessage || statusData.data?.msg || 'Tạo tác vụ thất bại');
          }
        }

        if (!processedImage) {
          return ctx.badRequest("Nano Banana API xử lý quá thời gian chờ (Timeout). Vui lòng thử lại.");
        }

        try {
          if (processedImage.startsWith('http')) {
            const imgRes = await fetch(processedImage);
            if (imgRes.ok) {
              const buffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(buffer).toString('base64');
              const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
              processedImage = `data:${mimeType};base64,${base64}`;
            }
          }
        } catch (e) {
          console.error("Lỗi khi tải ảnh kết quả từ Nano Banana:", e);
        }

        return { processedImage };
      }

      if (!geminiKey || geminiKey.trim() === "") {
        return ctx.badRequest("Gemini API Key chưa được cấu hình. Vui lòng vào Quản lý danh mục -> Cấu hình AI để dán API Key.");
      }

      const { GoogleGenAI } = await import('@google/genai');
      const aiClient = new GoogleGenAI({
        apiKey: geminiKey.trim(),
      });

      let mimeType = 'image/png';
      let base64Data = originalImage;
      if (originalImage.startsWith('data:')) {
        const matches = originalImage.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = originalImage.split(',')[1] || originalImage;
        }
      }

        const isFemaleGemini = gender === 'Nữ' || gender === 'female' || gender === 'nu';
        const outfitDescGemini = isFemaleGemini
          ? 'mặc áo sơ mi trắng có cổ bên trong, bên ngoài mặc áo véc (suit jacket / blazer) tối màu trang trọng dài tay. Tóc gọn gàng. TUYỆT ĐỐI KHÔNG mặc thêm áo gile/ghile, KHÔNG có áo vest lót không tay, KHÔNG com-lê 3 mảnh (strictly NO waistcoat, NO gilet, NO sleeveless vest).'
          : 'mặc áo sơ mi trắng có cổ bên trong, cổ đeo calavat (cà vạt), bên ngoài mặc áo véc (suit jacket / blazer) tối màu trang trọng dài tay. Tóc gọn gàng. TUYỆT ĐỐI KHÔNG mặc thêm áo gile/ghile, KHÔNG có áo vest lót không tay, KHÔNG com-lê 3 mảnh (strictly NO waistcoat, NO gilet, NO sleeveless vest).';

        const promptText = `Dựa vào khuôn mặt trong ảnh gốc được đính kèm, hãy giữ nguyên các đặc điểm nhận dạng khuôn mặt thật của người này. Tạo một bức ảnh chân dung ảnh thẻ kích thước tỷ lệ 3x4, chụp chính diện từ ngực trở lên, phông nền màu trắng, ánh sáng studio chuyên nghiệp đều, không bóng đổ phía sau. Chủ thể ${outfitDescGemini} Biểu cảm khuôn mặt nghiêm túc tự nhiên, nhìn thẳng vào máy ảnh, chất lượng sắc nét giống ảnh chụp studio thực tế.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: promptText },
          ],
        },
      });

      let processedUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          processedUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (processedUrl) {
        return { processedImage: processedUrl };
      } else {
        return ctx.internalServerError("Could not generate processed image from AI response.");
      }
    } catch (err: any) {
      console.error("[processPhoto] error:", err);
      return ctx.internalServerError("Lỗi kết nối hoặc xử lý từ Gemini API: " + (err.message || err));
    }
  },

  // Endpoint: GET /api/students/check-duplicate
  // Kiểm tra học viên đã đăng ký lớp này chưa dựa vào id_number + class_id
  // Params: ?id_number=<cccd>&class_id=<documentId>&exclude_student_id=<documentId optional>
  async checkDuplicate(ctx) {
    try {
      const { id_number, class_id, exclude_student_id } = ctx.query as any;

      if (!id_number || !class_id) {
        return { exists: false, count: 0, students: [] };
      }

      const knex = strapi.db.connection;

      let query = knex('students as s')
        .join('students_school_class_lnk as lnk', 's.id', 'lnk.student_id')
        .join('classes as cls', 'cls.id', 'lnk.school_class_id')
        .where(function() {
          this.where('s.id_number', id_number)
            .orWhere('s.student_code', id_number)
            .orWhere('s.card_number', id_number);
        })
        .where('cls.document_id', class_id)
        .select('s.id', 's.document_id as documentId', 's.full_name', 's.id_number', 'cls.name as class_name');

      // Khi đang edit, loại bỏ chính học viên đó khỏi kết quả
      if (exclude_student_id) {
        query = query.whereNot('s.document_id', exclude_student_id);
      }

      const rows = await query;

      return {
        exists: rows.length > 0,
        count: rows.length,
        students: rows.map((r: any) => ({
          id: r.documentId,
          fullName: r.full_name,
          idNumber: r.id_number,
          className: r.class_name,
        }))
      };
    } catch (err: any) {
      console.error('[checkDuplicate]', err);
      // Không throw — trả về false để không block UX khi backend lỗi
      return { exists: false, count: 0, students: [] };
    }
  },

  // Endpoint: GET /api/students/unassigned
  // Returns paginated students NOT in any OPENING or RECOGNITION decision
  async findUnassigned(ctx) {
    try {
      // Koa/Strapi parses nested query strings like ?pagination[page]=2&pagination[pageSize]=50
      // into ctx.query.pagination = { page: '2', pageSize: '50' }
      // NOT into ctx.query.page — so we must read from the nested object.
      const queryAny = ctx.query as any;
      const paginationParam = queryAny.pagination || {};
      const pageNum = parseInt(paginationParam.page || queryAny.page || '1', 10);
      const limit   = parseInt(paginationParam.pageSize || queryAny.pageSize || '50', 10);
      const offset  = (pageNum - 1) * limit;
      const filters = queryAny.filters || {};
      const populate = queryAny.populate || '*';

      const knex = strapi.db.connection;
      
      // NOT EXISTS is much faster than NOT IN at large scale (500k+ rows)
      // NOT IN: O(n*m) scan; NOT EXISTS: O(n*log m) with index
      let baseQuery = knex('students')
        .whereNotExists(function() {
          this.select(knex.raw('1'))
            .from('class_decisions_students_lnk as lnk')
            .join('class_decisions as cd', 'cd.id', 'lnk.class_decision_id')
            .whereRaw('lnk.student_id = students.id')
            .whereIn('cd.type', ['OPENING', 'RECOGNITION'])
            .whereNotNull('lnk.student_id');
        });

      if (filters && typeof filters === 'object') {
        const anyFilters = filters as any;

        // Handle text search: filters[$or][0][full_name][$containsi] or filters[$or][1][id_number][$contains]
        if (anyFilters['$or'] && Array.isArray(anyFilters['$or'])) {
           const orFilter = anyFilters['$or'];
           let term = '';
           if (orFilter[0]?.full_name?.$containsi) term = orFilter[0].full_name.$containsi;
           else if (orFilter[1]?.id_number?.$contains) term = orFilter[1].id_number.$contains;

           if (term) {
             const searchTerm = `%${term}%`;
             baseQuery = baseQuery.where((builder: any) => {
                 builder.where('students.full_name', 'ilike', searchTerm)
                        .orWhere('students.id_number', 'ilike', searchTerm)
                        .orWhere('students.student_code', 'ilike', searchTerm);
             });
           }
        }

        // Handle old group filter (kept for backward compat)
        if (anyFilters['group'] && anyFilters['group']['$eq']) {
           baseQuery = baseQuery.where('students.group', anyFilters['group']['$eq']);
        }

        // Handle school_class.name filter: filters[school_class][name][$eq]=ClassName
        if (anyFilters['school_class'] && anyFilters['school_class']['name'] && anyFilters['school_class']['name']['$eq']) {
           const className = anyFilters['school_class']['name']['$eq'];
           baseQuery = baseQuery
             .join('students_school_class_lnk as sc_lnk', 'students.id', 'sc_lnk.student_id')
             .join('classes as cls', 'cls.id', 'sc_lnk.school_class_id')
             .where('cls.name', className);
        }

        // Handle is_approved filter: filters[is_approved][$eq]=true
        if (anyFilters['is_approved'] && anyFilters['is_approved']['$eq'] !== undefined) {
           const approvedVal = anyFilters['is_approved']['$eq'];
           const isApproved = approvedVal === true || approvedVal === 'true' || approvedVal === '1';
           baseQuery = baseQuery.where('students.is_approved', isApproved);
        }
      }

      const studentIdsRecords = await baseQuery.clone()
        .select('students.document_id')
        .orderBy('students.created_at', 'desc')
        .limit(limit)
        .offset(offset);
      const documentIds = studentIdsRecords.map((r: any) => r.document_id);

      let formattedStudents: any[] = [];
      if (documentIds.length > 0) {
        const rawEntities = await strapi.documents('api::student.student').findMany({
            filters: { documentId: { $in: documentIds } },
            populate: populate as any
        });
        formattedStudents = documentIds.map(
          (docId: string) => (rawEntities as any[]).find(s => s.documentId === docId)
        ).filter(Boolean);
      }

      const countRes: any = await baseQuery.clone().clearSelect().count('* as count').first();
      const total = countRes ? parseInt((countRes as any).count as string, 10) : 0;

      return {
          data: formattedStudents,
          meta: {
              pagination: {
                  page: pageNum,
                  pageSize: limit,
                  pageCount: Math.ceil(total / limit),
                  total
              }
          }
      };
    } catch (err: any) {
      console.error(err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  },

  // Endpoint: GET /api/students/all-brief
  // Returns ALL students with minimal fields for dropdowns (no pagination)
  // Performance: loads in batches of 500, returns only needed columns
  async findAllBrief(ctx) {
    try {
      const knex = strapi.db.connection;
      
      // Direct SQL for maximum performance — only select needed columns
      const rows = await knex('students as s')
        .leftJoin('students_school_class_lnk as lnk', 's.id', 'lnk.student_id')
        .leftJoin('classes as c', 'c.id', 'lnk.class_id')
        .select(
          's.id',
          's.document_id as documentId',
          's.student_code',
          's.full_name',
          's.first_name',
          's.last_name',
          's.dob',
          's.pob',
          's.gender',
          's.id_number',
          's.group',
          's.class_code',
          's.company',
          's.phone',
          's.is_approved',
          'c.document_id as class_document_id',
          'c.name as class_name',
          'c.code as class_code_ref'
        )
        .orderBy('s.full_name', 'asc');

      const data = rows.map((r: any) => ({
        id: r.id,
        documentId: r.documentId,
        student_code: r.student_code,
        full_name: r.full_name,
        first_name: r.first_name,
        last_name: r.last_name,
        dob: r.dob,
        pob: r.pob,
        gender: r.gender,
        id_number: r.id_number,
        group: r.class_name || r.group || '',
        class_code: r.class_code_ref || r.class_code || '',
        class_name: r.class_name || '',
        class_document_id: r.class_document_id || '',
        company: r.company,
        phone: r.phone,
        is_approved: r.is_approved,
        photo: null,
        documents: []
      }));

      return {
        data,
        meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } }
      };
    } catch (err: any) {
      console.error(err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  }
}));
