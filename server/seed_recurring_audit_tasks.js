import db from './db.js';

async function seedRecurringTasks() {
  const tasksToInsert = [
    {
      title: '1. Goal Lakshya Target',
      description: 'Enquiry target, Order target, billing target, collection target, completion target, Project target.',
      category: 'Target & Finance',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'high',
      status: 'active',
      creator_id: 1
    },
    {
      title: '2. Vishwas Quality',
      description: 'Quality audit, standards compliance, and quality verification review across all engineering & operations.',
      category: 'Quality Assurance',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'high',
      status: 'active',
      creator_id: 1
    },
    {
      title: '3. Saksham Training',
      description: 'Staff training, skill development, staff incentives, and reward distribution.',
      category: 'Training & HR',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'medium',
      status: 'active',
      creator_id: 1
    },
    {
      title: '4. Niranthar Hiring',
      description: 'Continuous recruitment, candidate pipeline, hiring status, and talent acquisition.',
      category: 'Hiring & Talent',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'medium',
      status: 'active',
      creator_id: 1
    },
    {
      title: '5. Prasidha Marketing',
      description: 'How we build our brand: branding campaigns, lead generation, market outreach, and public visibility.',
      category: 'Marketing & Branding',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'medium',
      status: 'active',
      creator_id: 1
    },
    {
      title: '6. Sadhan Resources',
      description: 'Resource management, equipment, tools, operational facilities, and material availability.',
      category: 'Operations & Resources',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'medium',
      status: 'active',
      creator_id: 1
    },
    {
      title: '7. Avishkar Innovation',
      description: 'Product innovation, technical research, R&D initiatives, and workflow improvements.',
      category: 'R&D & Innovation',
      frequency: 'weekly',
      meeting_day: 'Monday',
      meeting_time: '10:00 AM',
      priority: 'high',
      status: 'active',
      creator_id: 1
    }
  ];

  const { rows: users } = await db.query('SELECT id FROM users');
  const userIds = users.map(u => u.id);

  for (const t of tasksToInsert) {
    const { rows: existing } = await db.query('SELECT id FROM repeated_tasks WHERE title ILIKE $1', ['%' + t.title.substring(3) + '%']);
    let taskId;
    if (existing.length > 0) {
      taskId = existing[0].id;
      console.log('Task already exists:', t.title, 'id:', taskId);
    } else {
      const { rows: [inserted] } = await db.query(`
        INSERT INTO repeated_tasks (title, description, category, frequency, meeting_day, meeting_time, priority, status, creator_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [t.title, t.description, t.category, t.frequency, t.meeting_day, t.meeting_time, t.priority, t.status, t.creator_id]);
      taskId = inserted.id;
      console.log('Inserted task:', t.title, 'with id:', taskId);
    }

    for (const uid of userIds) {
      await db.query(`
        INSERT INTO repeated_task_members (task_id, user_id, role_in_task)
        VALUES ($1, $2, 'reviewer')
        ON CONFLICT (task_id, user_id) DO NOTHING
      `, [taskId, uid]);
    }
  }

  console.log('Done seeding recurring audit tasks.');
  process.exit(0);
}

seedRecurringTasks().catch(err => {
  console.error(err);
  process.exit(1);
});
