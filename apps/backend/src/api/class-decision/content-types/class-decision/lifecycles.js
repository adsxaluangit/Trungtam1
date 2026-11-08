'use strict';

/**
 * Lifecycle callbacks for the `class-decision` model.
 * Prevents duplicate training courses within the same decision type.
 */

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (data.training_course) {
      const trainingCourseNormalized = data.training_course.trim();
      const type = data.type || 'OPENING';

      // Check for case-insensitive duplicate
      const existing = await strapi.db.query('api::class-decision.class-decision').findOne({
        where: {
          training_course: { $eqi: trainingCourseNormalized },
          type: type
        }
      });

      if (existing) {
        throw new Error(`Đợt/Khóa "${trainingCourseNormalized}" đã tồn tại cho loại quyết định này!`);
      }
    }
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // We need to check if training_course or type is being updated
    if (data.training_course !== undefined || data.type !== undefined) {
      // Get the record to check its current values
      const current = await strapi.db.query('api::class-decision.class-decision').findOne({ where });
      
      if (!current) return;

      const trainingCourse = data.training_course !== undefined ? data.training_course : current.training_course;
      const type = data.type !== undefined ? data.type : current.type;

      if (trainingCourse) {
        const trainingCourseNormalized = trainingCourse.trim();
        
        const existing = await strapi.db.query('api::class-decision.class-decision').findOne({
          where: {
            training_course: { $eqi: trainingCourseNormalized },
            type: type,
            id: { $ne: current.id }
          }
        });

        if (existing) {
          throw new Error(`Đợt/Khóa "${trainingCourseNormalized}" đã tồn tại cho loại quyết định này!`);
        }
      }
    }
  }
};
