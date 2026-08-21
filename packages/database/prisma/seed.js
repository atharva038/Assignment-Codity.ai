"use strict";
/**
 * ============================================================================
 * Database Seeder — Distributed Job Scheduler
 * ============================================================================
 * Seeds initial demo data:
 * - Admin & Standard Users
 * - Demo Organization & Project
 * - Default Retry Policies (Fixed, Linear, Exponential)
 * - Sample Email, Report, and Webhook Queues
 * - Sample Jobs in QUEUED, COMPLETED, and SCHEDULED states
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seeding...');
    // 1. Create Default Retry Policies
    const expPolicy = await prisma.retryPolicy.upsert({
        where: { id: 'policy-exponential-default' },
        update: {},
        create: {
            id: 'policy-exponential-default',
            name: 'Default Exponential Backoff',
            type: client_1.RetryPolicyType.EXPONENTIAL,
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 60000,
            backoffMultiplier: 2.0,
        },
    });
    const fixedPolicy = await prisma.retryPolicy.upsert({
        where: { id: 'policy-fixed-default' },
        update: {},
        create: {
            id: 'policy-fixed-default',
            name: 'Default Fixed Delay (5s)',
            type: client_1.RetryPolicyType.FIXED,
            maxAttempts: 5,
            initialDelayMs: 5000,
            maxDelayMs: 5000,
        },
    });
    console.log('✅ Created retry policies');
    // 2. Create Demo User
    const demoUser = await prisma.user.upsert({
        where: { email: 'admin@codity.ai' },
        update: {},
        create: {
            email: 'admin@codity.ai',
            name: 'Admin User',
            passwordHash: '$2b$10$epRmg5i.19v2x1/V7.nO4.b7lUo6iO95M8B6S9Vp6D/4x9x9x9x9x', // demo hash
            role: client_1.Role.ADMIN,
        },
    });
    // 3. Create Demo Organization
    const demoOrg = await prisma.organization.upsert({
        where: { slug: 'codity-corp' },
        update: {},
        create: {
            name: 'Codity Corporation',
            slug: 'codity-corp',
            members: {
                create: {
                    userId: demoUser.id,
                    role: client_1.OrgRole.OWNER,
                },
            },
        },
    });
    // 4. Create Demo Project
    const demoProject = await prisma.project.upsert({
        where: {
            organizationId_slug: {
                organizationId: demoOrg.id,
                slug: 'main-platform',
            },
        },
        update: {},
        create: {
            organizationId: demoOrg.id,
            name: 'Main Platform Services',
            slug: 'main-platform',
            description: 'Core production backend queues and scheduled worker pipelines.',
        },
    });
    console.log('✅ Created org & project:', demoOrg.name, '->', demoProject.name);
    // 5. Create Sample Queues
    const emailQueue = await prisma.queue.upsert({
        where: {
            projectId_name: {
                projectId: demoProject.id,
                name: 'email-notifications',
            },
        },
        update: {},
        create: {
            projectId: demoProject.id,
            name: 'email-notifications',
            priority: 20, // High priority
            concurrencyLimit: 5,
            status: client_1.QueueStatus.ACTIVE,
            retryPolicyId: expPolicy.id,
        },
    });
    const reportQueue = await prisma.queue.upsert({
        where: {
            projectId_name: {
                projectId: demoProject.id,
                name: 'report-generation',
            },
        },
        update: {},
        create: {
            projectId: demoProject.id,
            name: 'report-generation',
            priority: 10,
            concurrencyLimit: 2,
            status: client_1.QueueStatus.ACTIVE,
            retryPolicyId: fixedPolicy.id,
        },
    });
    console.log('✅ Created sample queues:', emailQueue.name, reportQueue.name);
    // 6. Create Initial Demo Jobs
    await prisma.job.createMany({
        data: [
            {
                queueId: emailQueue.id,
                type: 'email_notification',
                payload: { to: 'user1@example.com', subject: 'Welcome to Codity Scheduler!', template: 'welcome' },
                priority: 20,
                status: client_1.JobStatus.QUEUED,
                maxAttempts: 3,
                scheduledAt: new Date(),
            },
            {
                queueId: emailQueue.id,
                type: 'email_notification',
                payload: { to: 'user2@example.com', subject: 'Password Reset Request', template: 'reset_pass' },
                priority: 30, // Higher priority!
                status: client_1.JobStatus.QUEUED,
                maxAttempts: 3,
                scheduledAt: new Date(),
            },
            {
                queueId: reportQueue.id,
                type: 'report_generation',
                payload: { reportType: 'MONTHLY_SUMMARY', orgId: demoOrg.id, format: 'PDF' },
                priority: 10,
                status: client_1.JobStatus.QUEUED,
                maxAttempts: 5,
                scheduledAt: new Date(),
            },
        ],
        skipDuplicates: true,
    });
    console.log('✅ Seeded initial demo jobs!');
    console.log('🎉 Seeding completed successfully.');
}
main()
    .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map