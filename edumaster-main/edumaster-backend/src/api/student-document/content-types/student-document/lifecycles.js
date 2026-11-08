module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    if (!data) return;

    if (!data.id_number && data.student) {
      const studentId = typeof data.student === 'object' ? (data.student.id || data.student.connect?.[0]?.id) : data.student;
      if (studentId) {
        const knex = strapi.db.connection;
        const st = await knex('students')
          .where('id', studentId)
          .orWhere('document_id', String(studentId))
          .first();
        if (st) {
          data.id_number = st.id_number || st.student_code || '';
        }
      }
    }

    if (!data.id_number && data.url) {
      const match = String(data.url).match(/[_a-zA-Z](\d{9,12})_/);
      if (match) {
        data.id_number = match[1];
      }
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    if (!data) return;

    if (!data.id_number && data.student) {
      const studentId = typeof data.student === 'object' ? (data.student.id || data.student.connect?.[0]?.id) : data.student;
      if (studentId) {
        const knex = strapi.db.connection;
        const st = await knex('students')
          .where('id', studentId)
          .orWhere('document_id', String(studentId))
          .first();
        if (st) {
          data.id_number = st.id_number || st.student_code || '';
        }
      }
    }

    if (!data.id_number && data.url) {
      const match = String(data.url).match(/[_a-zA-Z](\d{9,12})_/);
      if (match) {
        data.id_number = match[1];
      }
    }
  }
};
