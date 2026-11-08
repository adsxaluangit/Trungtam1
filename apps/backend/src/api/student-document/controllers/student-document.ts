/**
 * student-document controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::student-document.student-document', ({ strapi }) => ({

  // GET /api/student-documents/by-id-number?id_number=<cccd>
  // Trả về tất cả tài liệu thuộc CCCD này — dùng chung cho mọi lớp của 1 học viên
  async findByIdNumber(ctx) {
    try {
      const { id_number } = ctx.query as any;

      if (!id_number) {
        return ctx.badRequest('Thiếu tham số id_number');
      }

      const knex = strapi.db.connection;

      const rows = await knex('student_documents as sd')
        .leftJoin('student_documents_student_lnk as lnk', 'lnk.student_document_id', 'sd.id')
        .leftJoin('students as s', 'lnk.student_id', 's.id')
        .where((builder) => {
          builder.where('sd.id_number', id_number)
            .orWhere('s.id_number', id_number)
            .orWhere('s.student_code', id_number)
            .orWhere('sd.url', 'like', `%${id_number}%`);
        })
        .select(
          'sd.id',
          'sd.document_id as documentId',
          'sd.name',
          'sd.url',
          'sd.type',
          'sd.date',
          'sd.id_number',
          'sd.created_at as createdAt'
        )
        .groupBy('sd.id', 'sd.document_id', 'sd.name', 'sd.url', 'sd.type', 'sd.date', 'sd.id_number', 'sd.created_at')
        .orderBy('sd.created_at', 'asc');

      // Deduplicate rows by URL so identical document files aren't repeated
      const uniqueMap = new Map();
      for (const r of rows) {
        const key = r.url || r.id;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: r.documentId || r.id,
            name: r.name,
            url: r.url,
            type: r.type,
            date: r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''),
            id_number: r.id_number || id_number,
          });
        }
      }

      return {
        data: Array.from(uniqueMap.values())
      };
    } catch (err: any) {
      console.error('[findByIdNumber]', err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  },

  // POST /api/student-documents/replace-or-create
  // Nếu đã có document cùng tên + CCCD / student / url → cập nhật URL (không tạo file mới)
  // Nếu chưa có → tạo mới bình thường
  // Body: { name, url, type, date, id_number, student }
  async replaceOrCreate(ctx) {
    try {
      const body = ctx.request.body as any;
      const { name, url, type, date, id_number, student } = body;

      if (!name || !url) {
        return ctx.badRequest('Thiếu name hoặc url');
      }

      const knex = strapi.db.connection;
      const fs = require('fs');
      const path = require('path');

      // Tự động suy ra id_number nếu bị thiếu
      let targetIdNumber = id_number || '';
      if (!targetIdNumber && student) {
        const stRow = await knex('students')
          .where('id', student)
          .orWhere('document_id', String(student))
          .first();
        if (stRow) {
          targetIdNumber = stRow.id_number || stRow.student_code || '';
        }
      }

      if (!targetIdNumber && url) {
        const match = String(url).match(/[_a-zA-Z](\d{9,12})_/);
        if (match) {
          targetIdNumber = match[1];
        }
      }

      // Tìm record cũ theo id_number + name HOẶC theo student_id + name HOẶC theo url
      let existing: any = null;
      if (targetIdNumber) {
        existing = await knex('student_documents')
          .where({ id_number: targetIdNumber, name })
          .orderBy('id', 'desc')
          .first();
      }

      if (!existing && student) {
        existing = await knex('student_documents as sd')
          .join('student_documents_student_lnk as lnk', 'lnk.student_document_id', 'sd.id')
          .where('lnk.student_id', student)
          .where('sd.name', name)
          .select('sd.*')
          .orderBy('sd.id', 'desc')
          .first();
      }

      if (!existing && url) {
        existing = await knex('student_documents')
          .where({ url })
          .orderBy('id', 'desc')
          .first();
      }

      if (existing) {
        const oldUrl = existing.url;
        // Nếu URL thay đổi, xóa file vật lý cũ nếu không còn nơi nào sử dụng
        if (oldUrl && oldUrl !== url) {
          try {
            const countDoc = await knex('student_documents').where('url', oldUrl).count('* as cnt').first();
            if (countDoc && Number(countDoc.cnt) <= 1) {
              const oldFilePath = path.join(process.cwd(), 'public', oldUrl.startsWith('/') ? oldUrl : '/' + oldUrl);
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
              }
            }
          } catch (e) {
            console.error('Failed to unlink old document file:', e);
          }
        }

        // Cập nhật record cũ
        await knex('student_documents')
          .where({ id: existing.id })
          .update({
            url,
            type: type || existing.type,
            id_number: targetIdNumber || existing.id_number,
            date: date || existing.date,
            updated_at: new Date()
          });

        // Đảm bảo liên kết với student nếu có
        if (student) {
          const lnkCheck = await knex('student_documents_student_lnk')
            .where({ student_document_id: existing.id, student_id: student })
            .first();
          if (!lnkCheck) {
            await knex('student_documents_student_lnk').insert({
              student_document_id: existing.id,
              student_id: student
            });
          }
        }

        return {
          data: {
            id: existing.document_id || existing.id,
            name: existing.name,
            url,
            type: type || existing.type,
            date: date || existing.date,
            id_number: targetIdNumber || existing.id_number,
            replaced: true
          }
        };
      }

      // Chưa có record phù hợp → tạo mới qua Strapi documents API
      const newDoc = await strapi.documents('api::student-document.student-document').create({
        data: {
          name,
          url,
          type: type || '',
          date: date || new Date().toLocaleDateString('vi-VN'),
          id_number: targetIdNumber || '',
          student: student ? Number(student) : undefined,
          publishedAt: new Date().toISOString()
        } as any
      });

      return {
        data: {
          id: (newDoc as any).documentId || (newDoc as any).id,
          name: (newDoc as any).name,
          url: (newDoc as any).url,
          type: (newDoc as any).type,
          date: (newDoc as any).date,
          id_number: (newDoc as any).id_number || targetIdNumber,
          replaced: false
        }
      };
    } catch (err: any) {
      console.error('[replaceOrCreate]', err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  }
}));
