export default {
    routes: [
      {
        method: 'GET',
        path: '/students/check-duplicate',
        handler: 'student.checkDuplicate',
        config: { auth: false },
      },
      {
        method: 'GET',
        path: '/students/unassigned',
        handler: 'student.findUnassigned',
        config: { auth: false },
      },
      {
        method: 'GET',
        path: '/students/all-brief',
        handler: 'student.findAllBrief',
        config: { auth: false },
      },
      {
        method: 'POST',
        path: '/students/process-photo',
        handler: 'student.processPhoto',
        config: { auth: false },
      },
    ],
  };
