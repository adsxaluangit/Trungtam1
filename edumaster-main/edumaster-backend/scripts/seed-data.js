const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbConfig = {
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '123456',
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: 'edumaster',
};

// Data from mockData.ts
const MOCK_NATIONS = [
    { id: 'n1', code: 'VN', name: 'Việt Nam', abbr: 'VN', status: 'active', created_at: '01/01/2025' },
    { id: 'n2', code: 'LAO', name: 'Lào', abbr: 'LAO', status: 'active', created_at: '01/01/2025' },
    { id: 'n3', code: 'KH', name: 'Campuchia', abbr: 'KH', status: 'active', created_at: '01/01/2025' },
    { id: 'n4', code: 'CN', name: 'Trung Quốc', abbr: 'CN', status: 'active', created_at: '01/01/2025' },
    { id: 'n5', code: 'JP', name: 'Nhật Bản', abbr: 'JP', status: 'active', created_at: '01/01/2025' },
];

const MOCK_SUPPLIERS = [
    { id: 's1', code: 'DA', name: 'Nhà A', taxid: '', phone: '', email: '', address: 'Khu vực Trung tâm', status: 'active', created_at: '01/01/2025' },
    { id: 's2', code: 'DB', name: 'Nhà B', taxid: '', phone: '', email: '', address: 'Khu vực Phía Tây', status: 'active', created_at: '01/01/2025' },
    { id: 's3', code: 'DC', name: 'Nhà C', taxid: '', phone: '', email: '', address: 'Khu vực Phía Đông', status: 'active', created_at: '01/01/2025' },
    { id: 's4', code: 'DD', name: 'Nhà D', taxid: '', phone: '', email: '', address: 'Khu xưởng thực hành', status: 'active', created_at: '01/01/2025' },
];

const MOCK_CLASSROOMS = [
    { id: 'cr1', code: 'P101', name: 'Phòng Lý thuyết 101', capacity: 40, building: 'Nhà A', status: 'active', created_at: '01/01/2025' },
    { id: 'cr2', code: 'P102', name: 'Phòng Lý thuyết 102', capacity: 40, building: 'Nhà A', status: 'active', created_at: '01/01/2025' },
    { id: 'cr3', code: 'P201', name: 'Phòng Máy tính 01', capacity: 30, building: 'Nhà B', status: 'active', created_at: '01/01/2025' },
    { id: 'cr4', code: 'P202', name: 'Phòng Máy tính 02', capacity: 30, building: 'Nhà B', status: 'active', created_at: '01/01/2025' },
    { id: 'cr5', code: 'X1', name: 'Xưởng Thực hành Điện', capacity: 20, building: 'Nhà D', status: 'active', created_at: '01/01/2025' },
    { id: 'cr6', code: 'X2', name: 'Xưởng Thực hành Cơ khí', capacity: 20, building: 'Nhà D', status: 'active', created_at: '01/01/2025' },
    { id: 'cr7', code: 'H1', name: 'Hội trường lớn', capacity: 200, building: 'Nhà C', status: 'active', created_at: '01/01/2025' },
];

const MOCK_SUBJECTS = [
    { id: 'sub1', code: 'MH001', name: 'An toàn vệ sinh lao động', sessions: 5, total_hours: 15, theory_hours: 5, practice_hours: 10, exercise_hours: 0, exam_hours: 2, notes: 'Môn bắt buộc', created_at: '01/01/2025' },
    { id: 'sub2', code: 'MH002', name: 'Tin học cơ sở', sessions: 15, total_hours: 45, theory_hours: 15, practice_hours: 30, exercise_hours: 0, exam_hours: 2, notes: '', created_at: '01/01/2025' },
    { id: 'sub3', code: 'MH003', name: 'Tiếng Anh chuyên ngành', sessions: 20, total_hours: 60, theory_hours: 30, practice_hours: 30, exercise_hours: 0, exam_hours: 2, notes: '', created_at: '01/01/2025' },
    { id: 'sub4', code: 'MH004', name: 'Kỹ thuật điện cơ bản', sessions: 30, total_hours: 90, theory_hours: 30, practice_hours: 60, exercise_hours: 0, exam_hours: 4, notes: '', created_at: '01/01/2025' },
    { id: 'sub5', code: 'MH005', name: 'Vẽ kỹ thuật', sessions: 15, total_hours: 45, theory_hours: 15, practice_hours: 30, exercise_hours: 0, exam_hours: 2, notes: '', created_at: '01/01/2025' },
    { id: 'sub6', code: 'MH006', name: 'Kỹ năng giao tiếp', sessions: 5, total_hours: 15, theory_hours: 5, practice_hours: 10, exercise_hours: 0, exam_hours: 1, notes: '', created_at: '01/01/2025' },
    { id: 'sub7', code: 'MH007', name: 'Pháp luật đại cương', sessions: 10, total_hours: 30, theory_hours: 30, practice_hours: 0, exercise_hours: 0, exam_hours: 2, notes: '', created_at: '01/01/2025' },
    { id: 'sub8', code: 'MH008', name: 'Giáo dục thể chất', sessions: 10, total_hours: 30, theory_hours: 0, practice_hours: 30, exercise_hours: 0, exam_hours: 0, notes: '', created_at: '01/01/2025' },
];

const MOCK_TEACHERS = [
    { id: 't1', code: 'GV001', name: 'Nguyễn Văn An', specialization: 'Kỹ thuật Điện', phone: '0912345678', email: 'an.nv@edumaster.vn', subjectIds: ['sub1', 'sub4'] },
    { id: 't2', code: 'GV002', name: 'Trần Thị Bình', specialization: 'Công nghệ thông tin', phone: '0987654321', email: 'binh.tt@edumaster.vn', subjectIds: ['sub2'] },
    { id: 't3', code: 'GV003', name: 'Lê Hoàng Cường', specialization: 'Ngoại ngữ', phone: '0901122334', email: 'cuong.lh@edumaster.vn', subjectIds: ['sub3'] },
    { id: 't4', code: 'GV004', name: 'Phạm Minh Dung', specialization: 'Cơ khí', phone: '0977889900', email: 'dung.pm@edumaster.vn', subjectIds: ['sub5'] },
    { id: 't5', code: 'GV005', name: 'Hoàng Văn Em', specialization: 'Kỹ năng', phone: '0933445566', email: 'em.hv@edumaster.vn', subjectIds: ['sub6', 'sub7'] },
];

const MOCK_CLASSES = [
    { id: 'cls1', code: 'K25-CNTT', name: 'Lớp Công nghệ thông tin K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub2', 'sub3', 'sub6'], start_date: '15/09/2024', end_date: '15/06/2025', student_count: 0, created_at: '01/01/2025' },
    { id: 'cls2', code: 'K25-DIEN', name: 'Lớp Điện Công nghiệp K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub1', 'sub4', 'sub5'], start_date: '15/09/2024', end_date: '15/06/2025', student_count: 0, created_at: '01/01/2025' },
    { id: 'cls3', code: 'K25-CK', name: 'Lớp Cơ khí K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub1', 'sub5'], start_date: '15/09/2024', end_date: '15/06/2025', student_count: 0, created_at: '01/01/2025' },
    { id: 'cls4', code: 'K24-CNTT', name: 'Lớp Công nghệ thông tin K24', notes: 'Năm cuối', status: 'OPENING', subjectIds: ['sub2', 'sub3'], start_date: '05/09/2023', end_date: '30/05/2026', student_count: 0, created_at: '01/01/2025' },
];

const MOCK_STUDENTS = [
    { id: 'std1', stt: 1, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', card_number: 'SV001', student_code: '25001', id_number: '001099000001', first_name: 'NAM', last_name: 'NGUYỄN VĂN', full_name: 'NGUYỄN VĂN NAM', gender: 'Nam', dob: '15/05/2005', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Hoàn Kiếm, Hà Nội', score: '', photo: null },
    { id: 'std2', stt: 2, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', card_number: 'SV002', student_code: '25002', id_number: '001099000002', first_name: 'HƯƠNG', last_name: 'TRẦN THỊ', full_name: 'TRẦN THỊ HƯƠNG', gender: 'Nữ', dob: '20/10/2005', pob: 'Hải Phòng', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Lê Chân, Hải Phòng', score: '', photo: null },
    { id: 'std3', stt: 3, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', card_number: 'SV003', student_code: '25003', id_number: '001099000003', first_name: 'TUẤN', last_name: 'LÊ MINH', full_name: 'LÊ MINH TUẤN', gender: 'Nam', dob: '01/01/2005', pob: 'Nam Định', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Soft', address: 'TP Nam Định', score: '', photo: null },
    { id: 'std4', stt: 4, group: 'Lớp Điện Công nghiệp K25', classCode: 'K25-DIEN', className: 'Lớp Điện Công nghiệp K25', card_number: 'SV004', student_code: '25004', id_number: '001099000004', first_name: 'HÙNG', last_name: 'PHẠM VĂN', full_name: 'PHẠM VĂN HÙNG', gender: 'Nam', dob: '12/12/2004', pob: 'Nghệ An', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Điện lực', address: 'Vinh, Nghệ An', score: '', photo: null },
    { id: 'std5', stt: 5, group: 'Lớp Điện Công nghiệp K25', classCode: 'K25-DIEN', className: 'Lớp Điện Công nghiệp K25', card_number: 'SV005', student_code: '25005', id_number: '001099000005', first_name: 'LAN', last_name: 'HOÀNG THỊ', full_name: 'HOÀNG THỊ LAN', gender: 'Nữ', dob: '08/03/2005', pob: 'Thanh Hóa', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Điện lực', address: 'TP Thanh Hóa', score: '', photo: null },
    { id: 'std6', stt: 6, group: 'Lớp Cơ khí K25', classCode: 'K25-CK', className: 'Lớp Cơ khí K25', card_number: 'SV006', student_code: '25006', id_number: '001099000006', first_name: 'DŨNG', last_name: 'VŨ TIẾN', full_name: 'VŨ TIẾN DŨNG', gender: 'Nam', dob: '02/09/2004', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Cơ khí A', address: 'Cầu Giấy, Hà Nội', score: '', photo: null },
    { id: 'std7', stt: 7, group: 'Lớp Cơ khí K25', classCode: 'K25-CK', className: 'Lớp Cơ khí K25', card_number: 'SV007', student_code: '25007', id_number: '001099000007', first_name: 'LONG', last_name: 'ĐẶNG VĂN', full_name: 'ĐẶNG VĂN LONG', gender: 'Nam', dob: '15/08/2004', pob: 'Bắc Ninh', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Cơ khí B', address: 'Từ Sơn, Bắc Ninh', score: '', photo: null },
    {
        id: 'std8', stt: 8, group: 'Lớp Công nghệ thông tin K24', classCode: 'K24-CNTT', className: 'Lớp Công nghệ thông tin K24', card_number: 'SV008', student_code: '24001', id_number: '001099000008', first_name: 'TRANG', last_name: 'NGUYỄN THU', full_name: 'NGUYỄN THU TRANG', gender: 'Nữ', dob: '20/11/2003', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'FPT', address: 'Ba Đình, Hà Nội', score: '', photo: null,
        documents: [
            { id: 'doc1', name: 'Sơ yếu lý lịch.pdf', url: '#', date: '01/01/2025', type: 'SYLL' },
            { id: 'doc2', name: 'Giấy khám sức khỏe.pdf', url: '#', date: '01/01/2025', type: 'GKSK' }
        ]
    },
    {
        id: 'std9', stt: 9, group: 'Lớp Công nghệ thông tin K24', classCode: 'K24-CNTT', className: 'Lớp Công nghệ thông tin K24', card_number: 'SV009', student_code: '24002', id_number: '001099000009', first_name: 'KHOA', last_name: 'LÊ ĐĂNG', full_name: 'LÊ ĐĂNG KHOA', gender: 'Nam', dob: '05/05/2003', pob: 'Đà Nẵng', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'FPT', address: 'Hải Châu, Đà Nẵng', score: '', photo: null,
        documents: [
            { id: 'doc3', name: 'Đơn xin học.docx', url: '#', date: '01/01/2025', type: 'DXH' }
        ]
    },
    { id: 'std10', stt: 10, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', card_number: 'SV010', student_code: '25008', id_number: '001099000010', first_name: 'QUÂN', last_name: 'BÙI ANH', full_name: 'BÙI ANH QUÂN', gender: 'Nam', dob: '10/10/2005', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Long Biên, Hà Nội', score: '', photo: null },
];

const seedData = async () => {
    const client = new Client(dbConfig);
    try {
        await client.connect();

        // Nations
        for (const i of MOCK_NATIONS) {
            await client.query('INSERT INTO nations (id, code, name, abbr, status, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.abbr, i.status, i.created_at]);
        }
        console.log('seeded nations');

        // Suppliers
        for (const i of MOCK_SUPPLIERS) {
            await client.query('INSERT INTO suppliers (id, code, name, tax_id, phone, email, address, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.taxid, i.phone, i.email, i.address, i.status, i.created_at]);
        }
        console.log('seeded suppliers');

        // Classrooms
        for (const i of MOCK_CLASSROOMS) {
            await client.query('INSERT INTO classrooms (id, code, name, capacity, building, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.capacity, i.building, i.status, i.created_at]);
        }
        console.log('seeded classrooms');

        // Subjects
        for (const i of MOCK_SUBJECTS) {
            await client.query('INSERT INTO subjects (id, code, name, sessions, total_hours, theory_hours, practice_hours, exercise_hours, exam_hours, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.sessions, i.total_hours, i.theory_hours, i.practice_hours, i.exercise_hours, i.exam_hours, i.notes, i.created_at]);
        }
        console.log('seeded subjects');

        // Teachers
        for (const i of MOCK_TEACHERS) {
            await client.query('INSERT INTO teachers (id, code, name, specialization, phone, email) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.specialization, i.phone, i.email]);
            if (i.subjectIds) {
                for (const subId of i.subjectIds) {
                    await client.query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT (teacher_id, subject_id) DO NOTHING', [i.id, subId]);
                }
            }
        }
        console.log('seeded teachers');

        // Classes
        for (const i of MOCK_CLASSES) {
            await client.query('INSERT INTO classes (id, code, name, notes, status, start_date, end_date, student_count, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING', [i.id, i.code, i.name, i.notes, i.status, i.start_date, i.end_date, i.student_count, i.created_at]);
            if (i.subjectIds) {
                for (const subId of i.subjectIds) {
                    await client.query('INSERT INTO class_subjects (class_id, subject_id) VALUES ($1, $2) ON CONFLICT (class_id, subject_id) DO NOTHING', [i.id, subId]);
                }
            }
        }
        console.log('seeded classes');

        // Students
        for (const i of MOCK_STUDENTS) {
            await client.query(`INSERT INTO students (id, stt, "group", class_code, class_name, card_number, student_code, id_number, first_name, last_name, full_name, gender, dob, pob, ethnicity, nationality, company, address, score, photo) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) ON CONFLICT (id) DO NOTHING`,
                [i.id, i.stt, i.group, i.classCode, i.className, i.card_number, i.student_code, i.id_number, i.first_name, i.last_name, i.full_name, i.gender, i.dob, i.pob, i.ethnicity, i.nationality, i.company, i.address, i.score, i.photo]);

            if (i.documents) {
                for (const doc of i.documents) {
                    await client.query('INSERT INTO student_documents (id, name, url, date, type, student_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [doc.id, doc.name, doc.url, doc.date, doc.type, i.id]);
                }
            }
        }
        console.log('seeded students');

        console.log("Database seeded successfully.");

    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        await client.end();
    }
};

seedData();
