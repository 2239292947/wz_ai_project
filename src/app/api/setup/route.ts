import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/setup - Initialize database tables
// Call this endpoint once after deployment to create tables
export async function GET() {
  try {
    // Test database connection and create tables by running a simple query
    // Prisma with db push should have already created tables during build,
    // but if not, this will help diagnose the issue

    // Try to query - if table doesn't exist, this will throw with a clear error
    await prisma.$queryRaw`SELECT 1`;

    // Try to count rules
    const ruleCount = await prisma.parseRule.count();
    const orderCount = await prisma.order.count();

    return NextResponse.json({
      success: true,
      message: 'Database connected successfully',
      tables: {
        rules: ruleCount,
        orders: orderCount,
      },
      databaseUrl: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'connected'}`
        : 'NOT SET',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Database setup error:', error);

    return NextResponse.json({
      success: false,
      error: message,
      stack: stack?.split('\n').slice(0, 5),
      databaseUrl: process.env.DATABASE_URL
        ? `Set (${process.env.DATABASE_URL.substring(0, 30)}...)`
        : 'NOT SET - Please configure DATABASE_URL in Vercel Environment Variables',
    }, { status: 500 });
  }
}
