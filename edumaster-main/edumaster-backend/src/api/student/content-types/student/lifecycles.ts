/**
 * Student Lifecycle Hooks
 *
 * afterCreate : Nếu record mới KHÔNG có ảnh → tự động tìm ảnh
 *               từ records cùng CCCD trong 5 năm gần nhất.
 *
 * afterUpdate : Nếu admin vừa THÊM/ĐỔI ảnh cho một record →
 *               tự động điền URL ảnh đó vào các records cùng CCCD
 *               đang photo = NULL (trong 5 năm). Không ghi đè
 *               records đã có ảnh (đảm bảo độc lập theo lớp).
 *
 * Quy tắc chung:
 * - Chỉ copy URL string → 0 file mới → không tốn ổ cứng
 * - Không throw lỗi → không chặn request
 */
export default {

  // ─── afterCreate ────────────────────────────────────────────
  async afterCreate(event: any) {
    const { result } = event;
    if (result.photo || !result.id_number || result.id_number.length < 9) return;

    try {
      const knex = (strapi as any).db.connection;
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const row = await knex('students')
        .where('id_number', result.id_number)
        .whereNot('id', result.id)
        .whereNotNull('photo')
        .where('photo', '!=', '')
        .where('created_at', '>=', fiveYearsAgo.toISOString())
        .orderBy('created_at', 'desc')
        .select('photo')
        .first();

      if (row?.photo) {
        await knex('students').where('id', result.id).update({ photo: row.photo });
        console.log(`[lifecycle afterCreate] Filled photo for CCCD ${result.id_number}`);
      }
    } catch (err: any) {
      console.error('[lifecycle afterCreate] error:', err?.message || err);
    }
  },

  // ─── afterUpdate ────────────────────────────────────────────
  async afterUpdate(event: any) {
    const { result } = event;

    // Chỉ lan truyền khi record vừa được cập nhật CÓ ảnh và có CCCD hợp lệ
    if (!result.photo || !result.id_number || result.id_number.length < 9) return;

    try {
      const knex = (strapi as any).db.connection;
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      // Chỉ cập nhật các records ĐANG THIẾU ảnh (photo IS NULL hoặc rỗng)
      // → KHÔNG ghi đè records đã có ảnh riêng (tính độc lập theo lớp)
      const count = await knex('students')
        .where('id_number', result.id_number)
        .whereNot('id', result.id)
        .where(function (this: any) {
          this.whereNull('photo').orWhere('photo', '');
        })
        .where('created_at', '>=', fiveYearsAgo.toISOString())
        .update({ photo: result.photo });

      if (count > 0) {
        console.log(`[lifecycle afterUpdate] Propagated photo to ${count} records for CCCD ${result.id_number}`);
      }
    } catch (err: any) {
      console.error('[lifecycle afterUpdate] error:', err?.message || err);
    }
  }
};
