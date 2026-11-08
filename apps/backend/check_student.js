
const strapi = require('@strapi/strapi');

async function checkStudent() {
  const app = await strapi().load();
  const knex = app.db.connection;
  
  const student = await knex('students')
    .where('id_number', '038202016821')
    .orWhere('student_code', '038202016821')
    .first();
    
  console.log('Student:', JSON.stringify(student, null, 2));
  
  if (student) {
    const decisions = await knex('class_decisions_students_lnk as lnk')
      .join('class_decisions as cd', 'cd.id', 'lnk.class_decision_id')
      .where('lnk.student_id', student.id)
      .select('cd.decision_number', 'cd.type', 'cd.id');
    console.log('Decisions:', JSON.stringify(decisions, null, 2));
  } else {
      // Search in decisions directly by name or something if not found in student table
      console.log('Student not found in students table');
  }
  
  process.exit(0);
}

checkStudent();
